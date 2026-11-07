#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { detectInstalls, type DiscordInstall } from './shared/paths'
import {
  asarFor,
  backupFor,
  hasBackup,
  installInto,
  isInstalled,
  patchDirFor,
  uninstallFrom,
} from './injector/install'

const args = process.argv.slice(2)
const command = args[0] ?? 'status'
const dryRun = args.includes('--dry-run')
const dirArgIndex = args.indexOf('--dir')
const customDir = dirArgIndex >= 0 ? args[dirArgIndex + 1] : undefined

// Bundled as CommonJS: the build output sits next to desktop.js / renderer.js.
const distDir = __dirname
const version = '1.0.0'

const describe = (install: DiscordInstall): string => {
  if (isInstalled(install)) return 'installed'
  if (existsSync(patchDirFor(install)) && !isInstalled(install)) return 'conflict'
  if (hasBackup(install)) return 'needs-repair'
  return 'not installed'
}

function targets(): DiscordInstall[] {
  if (customDir) {
    const resourcesDir = resolve(customDir)
    return [
      {
        branch: 'stable',
        label: `Custom (${resourcesDir})`,
        appRoot: resourcesDir,
        resourcesDir,
      },
    ]
  }
  return detectInstalls()
}

function status() {
  const installs = targets()
  if (installs.length === 0) {
    console.log('No Discord installation found.')
    console.log('Checked the standard Stable / PTB / Canary locations for this OS.')
    console.log('If Discord is installed somewhere else, pass --dir "<path to resources>".')
    process.exitCode = 1
    return
  }

  for (const install of installs) {
    console.log(`${install.label}: ${install.resourcesDir}`)
    console.log(`  status       : ${describe(install)}`)
    console.log(`  app.asar     : ${existsSync(asarFor(install)) ? 'present' : 'missing'} (${asarFor(install)})`)
    console.log(`  backup       : ${hasBackup(install) ? backupFor(install) : 'none'}`)
  }
}

function install() {
  const installs = targets()
  if (installs.length === 0) {
    console.error('No Discord installation found. Pass --dir "<path to Discord resources>".')
    process.exitCode = 1
    return
  }

  let failures = 0
  for (const target of installs) {
    try {
      const result = installInto(target, { distDir, version, dryRun })
      console.log(`${target.label}: ${result.status}`)
      console.log(`  ${result.message}`)
      if (result.status === 'conflict' || result.status === 'missing-asar') failures += 1
    } catch (error) {
      failures += 1
      console.error(`${target.label}: failed — ${(error as Error).message}`)
    }
  }

  if (failures > 0) process.exitCode = 1
  else if (!dryRun) console.log('\nDone. Fully quit Discord (tray → Quit) and start it again.')
}

function uninstall() {
  const installs = targets()
  if (installs.length === 0) {
    console.log('No Discord installation found.')
    process.exitCode = 1
    return
  }
  for (const target of installs) {
    const result = uninstallFrom(target)
    console.log(`${target.label}: ${result.message}`)
  }
}

switch (command) {
  case 'install':
    install()
    break
  case 'uninstall':
    uninstall()
    break
  case 'status':
    status()
    break
  default:
    console.log(`Fluenta mod injector

Usage:
  node mod/dist/cli.cjs status
  node mod/dist/cli.cjs install [--dry-run] [--dir <resources path>]
  node mod/dist/cli.cjs uninstall [--dir <resources path>]
`)
    if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
}
