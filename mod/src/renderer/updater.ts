import { MOD_VERSION } from '../shared/version'

export const RELEASES_URL = 'https://github.com/itriedcoding/Fluenta-Chat/releases'
const LATEST_API = 'https://api.github.com/repos/itriedcoding/Fluenta-Chat/releases/latest'

const compare = (a: string, b: string): number => {
  const left = a.replace(/^v/i, '').split('.').map(Number)
  const right = b.replace(/^v/i, '').split('.').map(Number)
  for (let i = 0; i < 3; i += 1) {
    const diff = (left[i] || 0) - (right[i] || 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

export interface ModUpdate {
  latest: string
  url: string
}

/**
 * Asks GitHub for the newest release. Discord's renderer CSP can block requests
 * to api.github.com, so callers fall back to opening the releases page.
 */
export async function checkModUpdate(): Promise<ModUpdate | null> {
  const response = await fetch(LATEST_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  const release = (await response.json()) as {
    tag_name: string
    html_url: string
    assets: { name: string; browser_download_url: string }[]
  }
  const latest = release.tag_name.replace(/^v/i, '')
  if (compare(latest, MOD_VERSION) <= 0) return null

  const installer = release.assets.find((asset) => asset.name === 'cli.cjs')
  return { latest, url: installer?.browser_download_url ?? release.html_url }
}
