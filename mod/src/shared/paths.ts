import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type Branch = 'stable' | 'ptb' | 'canary'

export interface DiscordInstall {
  branch: Branch
  /** Human readable label, e.g. "Discord (stable)". */
  label: string
  /** Directory that contains resources/ (the app-<version> folder on Windows). */
  appRoot: string
  /** .../resources */
  resourcesDir: string
}

interface Env {
  LOCALAPPDATA?: string
  APPDATA?: string
  HOME?: string
  XDG_DATA_HOME?: string
}

const BRANCH_LABEL: Record<Branch, string> = {
  stable: 'Discord',
  ptb: 'Discord PTB',
  canary: 'Discord Canary',
}

const windowsRoots = (env: Env): { branch: Branch; root: string }[] => {
  const base = env.LOCALAPPDATA
  if (!base) return []
  return [
    { branch: 'stable', root: join(base, 'Discord') },
    { branch: 'ptb', root: join(base, 'DiscordPTB') },
    { branch: 'canary', root: join(base, 'DiscordCanary') },
  ]
}

const macRoots = (): { branch: Branch; root: string }[] => [
  { branch: 'stable', root: '/Applications/Discord.app/Contents/Resources' },
  { branch: 'ptb', root: '/Applications/Discord PTB.app/Contents/Resources' },
  { branch: 'canary', root: '/Applications/Discord Canary.app/Contents/Resources' },
  { branch: 'stable', root: join(homedir(), 'Applications/Discord.app/Contents/Resources') },
]

const linuxRoots = (env: Env): { branch: Branch; root: string }[] => {
  const home = env.HOME ?? homedir()
  return [
    { branch: 'stable', root: '/usr/share/discord/resources' },
    { branch: 'stable', root: '/opt/discord/resources' },
    { branch: 'stable', root: '/usr/lib/discord/resources' },
    { branch: 'stable', root: join(home, '.local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources') },
    { branch: 'stable', root: '/var/lib/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources' },
    { branch: 'stable', root: join(home, 'snap/discord/current/usr/share/discord/resources') },
    { branch: 'ptb', root: '/usr/share/discord-ptb/resources' },
    { branch: 'canary', root: '/usr/share/discord-canary/resources' },
  ]
}

const byDescendingVersion = (a: string, b: string) =>
  b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' })

/**
 * Discord on Windows installs each update into `%LOCALAPPDATA%\Discord\app-<ver>`,
 * so one installation can contain several app folders. The newest one that has a
 * resources/app.asar is the one currently launched.
 */
export function findWindowsInstalls(
  env: Env = process.env,
  exists: (path: string) => boolean = existsSync,
  readdir: (path: string) => string[] = readdirSync,
): DiscordInstall[] {
  const found: DiscordInstall[] = []
  for (const { branch, root } of windowsRoots(env)) {
    if (!exists(root)) continue
    let entries: string[]
    try {
      entries = readdir(root).filter((name) => name.startsWith('app-'))
    } catch {
      continue
    }
    for (const entry of entries.sort(byDescendingVersion)) {
      const appRoot = join(root, entry)
      const resourcesDir = join(appRoot, 'resources')
      if (exists(join(resourcesDir, 'app.asar')) || exists(join(resourcesDir, 'app'))) {
        found.push({ branch, label: BRANCH_LABEL[branch], appRoot, resourcesDir })
        break
      }
    }
  }
  return found
}

export function findUnixInstalls(
  platform: NodeJS.Platform,
  env: Env,
  exists: (path: string) => boolean,
): DiscordInstall[] {
  const roots = platform === 'darwin' ? macRoots() : linuxRoots(env)
  const found: DiscordInstall[] = []
  const seen = new Set<string>()
  for (const { branch, root } of roots) {
    // On macOS the resources folder IS the resources dir; elsewhere it ends in it.
    const resourcesDir = root
    if (seen.has(resourcesDir)) continue
    const hasAsar = exists(join(resourcesDir, 'app.asar'))
    const hasPatch = exists(join(resourcesDir, 'app', '.fluenta'))
    if (hasAsar || hasPatch) {
      seen.add(resourcesDir)
      found.push({
        branch,
        label: BRANCH_LABEL[branch],
        appRoot: resourcesDir,
        resourcesDir,
      })
    }
  }
  return found
}

export function detectInstalls(
  platform: NodeJS.Platform = process.platform,
  env: Env = process.env,
  exists: (path: string) => boolean = existsSync,
  readdir: (path: string) => string[] = readdirSync,
): DiscordInstall[] {
  if (platform === 'win32') return findWindowsInstalls(env, exists, readdir)
  return findUnixInstalls(platform, env, exists)
}

export function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}
