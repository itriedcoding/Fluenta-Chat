import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { extractAll } from '@electron/asar'
import type { DiscordInstall } from '../shared/paths'

export const MARKER = '.fluenta'
export const PATCH_DIR = 'app'
export const BACKUP_NAME = 'app.asar.fluenta-backup'
export const LOADER_HEADER = '/* Fluenta mod loader */\n'

const LOADER_RUNTIME = `try {
  require("./fluenta/desktop.js");
} catch (error) {
  console.error("[Fluenta] failed to start:", error);
}
`

export type InstallStatus =
  | 'installed'
  | 'already-installed'
  | 'conflict'
  | 'missing-asar'
  | 'dry-run'

export interface InstallResult {
  install: DiscordInstall
  status: InstallStatus
  message: string
}

export interface InstallOptions {
  /** Directory containing desktop.js and renderer.js */
  distDir: string
  version: string
  dryRun?: boolean
}

export const patchDirFor = (install: DiscordInstall) =>
  join(install.resourcesDir, PATCH_DIR)
export const backupFor = (install: DiscordInstall) =>
  join(install.resourcesDir, BACKUP_NAME)
export const asarFor = (install: DiscordInstall) =>
  join(install.resourcesDir, 'app.asar')

export function isInstalled(install: DiscordInstall): boolean {
  return existsSync(join(patchDirFor(install), MARKER))
}

export function hasBackup(install: DiscordInstall): boolean {
  return existsSync(backupFor(install))
}

/** The main-process entry Discord executes; patched to require our loader first. */
export function patchIndexSource(source: string): string {
  if (source.startsWith(LOADER_HEADER)) return source
  return `${LOADER_HEADER}${LOADER_RUNTIME}${source}`
}

export function installInto(
  install: DiscordInstall,
  options: InstallOptions,
): InstallResult {
  const patchDir = patchDirFor(install)
  const asarPath = asarFor(install)
  const backup = backupFor(install)

  if (isInstalled(install)) {
    return {
      install,
      status: 'already-installed',
      message: 'Fluenta is already installed in this Discord. Use uninstall first to reinstall.',
    }
  }

  if (existsSync(patchDir)) {
    return {
      install,
      status: 'conflict',
      message: `${patchDir} already exists but is not a Fluenta install (another mod?). Refusing to overwrite it.`,
    }
  }

  if (!existsSync(asarPath)) {
    return {
      install,
      status: 'missing-asar',
      message: `No app.asar found in ${install.resourcesDir}.`,
    }
  }

  for (const file of ['desktop.js', 'renderer.js']) {
    if (!existsSync(join(options.distDir, file))) {
      throw new Error(`Missing build output ${file} in ${options.distDir}. Run \`npm run mod:build\` first.`)
    }
  }

  if (options.dryRun) {
    return {
      install,
      status: 'dry-run',
      message: `Would unpatch ${asarPath} into ${patchDir}, inject the loader and copy the renderer.`,
    }
  }

  const tempDir = join(install.resourcesDir, '.fluenta-tmp')
  rmSync(tempDir, { recursive: true, force: true })

  try {
    // Extract the whole archive so Electron can load a plain directory instead.
    extractAll(asarPath, tempDir)

    const indexPath = join(tempDir, 'index.js')
    if (!existsSync(indexPath)) {
      throw new Error('app.asar has no index.js — this does not look like Discord.')
    }
    const original = readFileSync(indexPath, 'utf8')
    writeFileSync(indexPath, patchIndexSource(original))

    const runtimeDir = join(tempDir, 'fluenta')
    mkdirSync(runtimeDir, { recursive: true })
    cpSync(join(options.distDir, 'desktop.js'), join(runtimeDir, 'desktop.js'))
    cpSync(join(options.distDir, 'renderer.js'), join(runtimeDir, 'renderer.js'))

    writeFileSync(
      join(tempDir, MARKER),
      JSON.stringify(
        { version: options.version, installedAt: new Date().toISOString() },
        null,
        2,
      ),
    )

    // Move the finished tree into place, then hide the original archive so
    // Electron loads our patched directory.
    renameSync(tempDir, patchDir)
    if (!existsSync(backup)) renameSync(asarPath, backup)

    return {
      install,
      status: 'installed',
      message: `Installed into ${patchDir}. Restart Discord to load Fluenta.`,
    }
  } catch (error) {
    rmSync(tempDir, { recursive: true, force: true })
    throw error
  }
}

export function uninstallFrom(install: DiscordInstall): InstallResult {
  const patchDir = patchDirFor(install)
  const asarPath = asarFor(install)
  const backup = backupFor(install)

  if (!isInstalled(install)) {
    return {
      install,
      status: 'already-installed',
      message: 'Fluenta is not installed in this Discord.',
    }
  }

  rmSync(patchDir, { recursive: true, force: true })
  if (existsSync(backup)) {
    if (existsSync(asarPath)) rmSync(asarPath, { force: true })
    renameSync(backup, asarPath)
  }

  return {
    install,
    status: 'installed',
    message: 'Removed Fluenta and restored the original app.asar.',
  }
}
