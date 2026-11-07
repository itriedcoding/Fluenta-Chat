/**
 * Access to Discord's own webpack modules from inside the renderer.
 *
 * Discord ships the client as a webpack bundle. The chunk array
 * (`webpackChunkdiscord_app`) is global, so a mod can resolve modules by
 * inspecting their factories and then require them exactly like Discord does.
 */

type AnyRecord = Record<string, any>

type WebpackRequire = ((id: string) => AnyRecord | undefined) & {
  c?: Record<string, AnyRecord>
}

let wpRequire: WebpackRequire | null = null
const resolved = new Map<string, AnyRecord | null>()

export function hasWebpack(): boolean {
  return Array.isArray((window as any).webpackChunkdiscord_app)
}

export function getWebpackRequire(): WebpackRequire {
  if (wpRequire) return wpRequire
  const globalObject = window as any
  const chunks: any[] = globalObject.webpackChunkdiscord_app ?? []
  if (!Array.isArray(chunks)) throw new Error('Discord webpack chunk array missing')

  chunks.push([
    [Symbol('fluenta-runtime')],
    {},
    (runtime: WebpackRequire) => {
      wpRequire = runtime
    },
  ])

  if (!wpRequire) throw new Error('Discord webpack runtime not available')
  return wpRequire
}

/** Every module factory Discord has pushed, including ones not yet required. */
export function eachFactory(visit: (id: string, factory: (...args: any[]) => any) => void) {
  const chunks: any[] = (window as any).webpackChunkdiscord_app ?? []
  for (const chunk of chunks) {
    const modules = chunk?.[1]
    if (!modules || typeof modules !== 'object') continue
    for (const id of Object.keys(modules)) {
      const factory = modules[id]
      if (typeof factory === 'function') visit(id, factory)
    }
  }
}

function requireModule(id: string): AnyRecord | null {
  if (resolved.has(id)) return resolved.get(id) ?? null
  let exports: AnyRecord | null = null
  try {
    exports = getWebpackRequire()(id) ?? null
  } catch {
    exports = null
  }
  resolved.set(id, exports)
  return exports
}

const candidates = (exports: AnyRecord): AnyRecord[] => {
  const list: AnyRecord[] = [exports]
  if (exports && typeof exports === 'object' && exports.default && typeof exports.default === 'object') {
    list.push(exports.default)
  }
  return list
}

export function findByProps<T = AnyRecord>(...props: string[]): T | null {
  const runtime = getWebpackRequire()
  const cache = runtime.c ?? {}

  for (const exports of Object.values(cache) as AnyRecord[]) {
    for (const candidate of candidates(exports)) {
      if (props.every((prop) => candidate?.[prop] !== undefined)) return candidate as T
    }
  }

  for (const exports of findBySource(/./)) {
    for (const candidate of candidates(exports)) {
      if (props.every((prop) => candidate?.[prop] !== undefined)) return candidate as T
    }
  }
  return null
}

export function findBySource(pattern: RegExp, limit = 3000): AnyRecord[] {
  const matches: AnyRecord[] = []
  const seen = new Set<string>()

  eachFactory((id, factory) => {
    if (matches.length >= limit) return
    let source: string
    try {
      source = String(factory)
    } catch {
      return
    }
    // Webpack wraps factories; only look at the body.
    if (!pattern.test(source) || seen.has(id)) return
    seen.add(id)
    const exports = requireModule(id)
    if (exports) matches.push(exports)
  })

  return matches
}

export interface FluxDispatcher {
  dispatch: (action: AnyRecord) => void
  subscribe: (event: string, handler: (payload: any) => void) => void
  unsubscribe: (event: string, handler: (payload: any) => void) => void
  isDispatching?: () => boolean
}

/** Test helper: drops resolved-module and dispatcher caches. */
export function __resetPatcherCache() {
  wpRequire = null
  dispatcher = null
  resolved.clear()
}

let dispatcher: FluxDispatcher | null = null

export function getDispatcher(): FluxDispatcher | null {
  if (dispatcher) return dispatcher

  const byShape = findByProps<FluxDispatcher>(
    'dispatch',
    'subscribe',
    'unsubscribe',
    '_actionHandlers',
  )
  if (byShape && typeof byShape.subscribe === 'function') {
    dispatcher = byShape
    return dispatcher
  }

  for (const exports of findBySource(/isDispatching/)) {
    for (const candidate of candidates(exports)) {
      if (
        typeof candidate?.subscribe === 'function' &&
        typeof candidate?.dispatch === 'function' &&
        candidate?._actionHandlers
      ) {
        dispatcher = candidate as FluxDispatcher
        return dispatcher
      }
    }
  }

  return null
}

export function subscribe(event: string, handler: (payload: any) => void): () => void {
  const flux = getDispatcher()
  if (!flux) throw new Error('Discord Flux dispatcher not found')
  flux.subscribe(event, handler)
  return () => {
    try {
      flux.unsubscribe(event, handler)
    } catch {
      /* already gone */
    }
  }
}
