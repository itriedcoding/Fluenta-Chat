/**
 * HTTP transport that works identically in a browser, inside the Tauri shell
 * (Windows) and inside the Capacitor WebView (Android).
 *
 * Discord's API reflects the request Origin, so plain browser fetch is enough
 * for the web build. The native shells still benefit from routing through the
 * platform HTTP stack (no preflights, no CORS surprises, system proxy support).
 */

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
    Capacitor?: {
      isNativePlatform?: () => boolean
      getPlatform?: () => string
    }
  }
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__

export const isNativeMobile = (): boolean =>
  typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.()

export const platformName = (): string => {
  if (isTauri()) return 'Windows'
  if (isNativeMobile()) return 'Android'
  return 'Web'
}

const toResponse = (data: unknown, status: number, headers: Record<string, string>) => {
  let body: string | null = null
  if (typeof data === 'string') body = data
  else if (data !== undefined && data !== null) body = JSON.stringify(data)
  return new Response(body, { status, headers })
}

export async function request(url: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase()

  if (isTauri()) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(url, init) as unknown as Response
  }

  if (isNativeMobile()) {
    const { CapacitorHttp } = await import('@capacitor/core')
    let payload: unknown
    if (typeof init.body === 'string') {
      try {
        payload = JSON.parse(init.body)
      } catch {
        payload = init.body
      }
    }
    const res = await CapacitorHttp.request({
      url,
      method,
      headers: (init.headers ?? {}) as Record<string, string>,
      data: payload,
      connectTimeout: 20000,
      readTimeout: 30000,
    })
    const headers: Record<string, string> = {}
    for (const [k, v] of Object.entries(res.headers ?? {})) headers[k] = String(v)
    return toResponse(res.data, res.status, headers)
  }

  return fetch(url, init)
}
