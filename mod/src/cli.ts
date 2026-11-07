#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
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
import { downloadTo, fetchLatestRelease } from './injector/update'
import { MOD_VERSION } from './shared/version'

const args = process.argv.slice(2)
const command = args[0] ?? 'status'
const dryRun = args.includes('--dry-run')
const dirArgIndex = args.indexOf('--dir')
const customDir = dirArgIndex >= 0 ? args[dirArgIndex + 1] : undefined

// Bundled as CommonJS: the build output sits next to desktop.js / renderer.js.
const distDir = __dirname
const version = MOD_VERSION

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

/** Pulls the newest desktop.js/renderer.js from the latest GitHub release. */
async function update() {
  const release = await fetchLatestRelease()
  if (!release) {
    console.error('No Fluenta release published yet — nothing to update to.')
    process.exitCode = 1
    return
  }

  const latest = release.tag_name.replace(/^v/i, '')
  console.log(`Latest release: ${release.tag_name} (${release.published_at})`)

  for (const name of ['desktop.js', 'renderer.js']) {
    const asset = release.assets.find((item) => item.name === name)
    if (!asset) {
      console.error(`Release ${latest} does not include ${name}; aborting.`)
      process.exitCode = 1
      return
    }
    console.log(`Downloading ${name} (${asset.size} bytes)…`)
    await downloadTo(asset.browser_download_url, join(distDir, name))
  }
  console.log('Downloaded the latest mod build.')

  const installs = targets()
  if (installs.length === 0) {
    console.log('No Discord install found; files are updated for the next install.')
    return
  }

  for (const target of installs) {
    if (isInstalled(target)) uninstallFrom(target)
    const result = installInto(target, { distDir, version: latest })
    console.log(`${target.label}: ${result.status} — ${result.message}`)
  }
  console.log('Restart Discord to run the updated mod.')
}

async function main() {
  switch (command) {
    case 'install':
      install()
      break
    case 'uninstall':
      uninstall()
      break
    case 'update':
      await update()
      break
    case 'status':
      status()
      break
    default:
      console.log(`Fluenta mod injector v${MOD_VERSION}

Usage:
  node mod/dist/cli.cjs status
  node mod/dist/cli.cjs install [--dry-run] [--dir <resources path>]
  node mod/dist/cli.cjs uninstall [--dir <resources path>]
  node mod/dist/cli.cjs update [--dir <resources path>]
`)
      if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
  }
}

void main().catch((error) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
