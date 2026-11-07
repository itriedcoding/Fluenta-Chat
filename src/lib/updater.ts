import { isNativeMobile, platformName } from './transport'

export const REPO = 'itriedcoding/Fluenta-Chat'
export const RELEASES_PAGE = `https://github.com/${REPO}/releases`
const LATEST_API = `https://api.github.com/repos/${REPO}/releases/latest`
const CACHE_KEY = 'fluenta.updateCheck'

export interface ReleaseAsset {
  name: string
  size: number
  browser_download_url: string
}

export interface Release {
  tag_name: string
  name: string | null
  html_url: string
  body: string | null
  published_at: string
  assets: ReleaseAsset[]
}

export type UpdateStatus = 'checking' | 'available' | 'current' | 'unavailable' | 'error'

export interface UpdateCheck {
  status: UpdateStatus
  current: string
  latest?: string
  release?: Release
  asset?: ReleaseAsset
  message?: string
}

/** Numeric semver comparison; anything unparsable sorts as 0. */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) =>
    value
      .replace(/^v/i, '')
      .split(/[.+-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0))
  const left = parse(a)
  const right = parse(b)
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const diff = (left[i] ?? 0) - (right[i] ?? 0)
    if (diff !== 0) return diff > 0 ? 1 : -1
  }
  return 0
}

function pickAsset(release: Release): ReleaseAsset | undefined {
  const assets = release.assets ?? []
  const platform = platformName()
  const matches = (asset: ReleaseAsset, extensions: string[]) =>
    extensions.some((ext) => asset.name.toLowerCase().endsWith(ext))

  if (platform === 'Android' || (isNativeMobile() && !platform.includes('Windows'))) {
    return assets.find((asset) => matches(asset, ['.apk']))
  }
  if (platform === 'Windows') {
    return (
      assets.find(
        (asset) =>
          asset.name.toLowerCase().endsWith('.exe') &&
          asset.name.toLowerCase().includes('setup'),
      ) ?? assets.find((asset) => matches(asset, ['.exe', '.msi']))
    )
  }
  return assets.find((asset) => matches(asset, ['.apk', '.exe', '.msi']))
}

export async function fetchLatestRelease(): Promise<Release | null> {
  const response = await fetch(LATEST_API, {
    headers: { Accept: 'application/vnd.github+json' },
  })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`GitHub releases request failed (HTTP ${response.status})`)
  }
  return (await response.json()) as Release
}

function cached(): UpdateCheck | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { at: number; check: UpdateCheck }
    if (Date.now() - parsed.at > 60 * 60 * 1000) return null
    return parsed.check
  } catch {
    return null
  }
}

function remember(check: UpdateCheck) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), check }))
  } catch {
    /* ignore */
  }
}

/**
 * Compares the running build against the newest GitHub release and resolves
 * the download asset for this platform. Results are cached for an hour.
 */
export async function checkForUpdate(
  current: string,
  options: { force?: boolean } = {},
): Promise<UpdateCheck> {
  if (!options.force) {
    const hit = cached()
    if (hit) return hit
  }

  try {
    const release = await fetchLatestRelease()
    if (!release) {
      return {
        status: 'unavailable',
        current,
        message: 'No releases published yet.',
      }
    }
    const latest = release.tag_name.replace(/^v/i, '')
    const available = compareVersions(latest, current) > 0
    const check: UpdateCheck = {
      status: available ? 'available' : 'current',
      current,
      latest,
      release,
      asset: pickAsset(release),
    }
    remember(check)
    return check
  } catch (error) {
    return {
      status: 'error',
      current,
      message: error instanceof Error ? error.message : 'Could not reach GitHub.',
    }
  }
}
