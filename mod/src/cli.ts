#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { createInterface } from 'node:readline/promises'
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

declare const __dirname: string | undefined

const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const dirArgIndex = args.indexOf('--dir')
const customDir = dirArgIndex >= 0 ? args[dirArgIndex + 1] : undefined
const dryRun = flags.has('--dry-run')
const command =
  args.find((arg) => !arg.startsWith('--') && arg !== customDir) ??
  (process.stdin.isTTY ? 'menu' : 'status')

/** Where the installer keeps downloaded mod bundles when it is a standalone exe. */
export function installerWorkDir(): string {
  if (process.env.FLUENTA_HOME) return resolve(process.env.FLUENTA_HOME)
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    return join(process.env.LOCALAPPDATA, 'Fluenta')
  }
  return join(homedir(), '.fluenta')
}

const runningFromBuild =
  typeof __dirname === 'string' && existsSync(join(__dirname, 'desktop.js'))

let distDir = runningFromBuild ? (__dirname as string) : installerWorkDir()
let version = MOD_VERSION

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
      { branch: 'stable', label: `Custom (${resourcesDir})`, appRoot: resourcesDir, resourcesDir },
    ]
  }
  return detectInstalls()
}

function printStatus() {
  const installs = targets()
  if (installs.length === 0) {
    console.log('No Discord installation found.')
    console.log('Checked the standard Stable / PTB / Canary locations for this OS.')
    console.log('If Discord is installed elsewhere, pass --dir "<path to resources>".')
    return false
  }
  for (const install of installs) {
    console.log(`${install.label}: ${install.resourcesDir}`)
    console.log(`  status   : ${describe(install)}`)
    console.log(`  app.asar : ${existsSync(asarFor(install)) ? 'present' : 'missing'}`)
    console.log(`  backup   : ${hasBackup(install) ? backupFor(install) : 'none'}`)
  }
  return true
}

/** Downloads desktop.js / renderer.js from the newest GitHub release if needed. */
async function ensureBundles(): Promise<void> {
  mkdirSync(distDir, { recursive: true })
  if (existsSync(join(distDir, 'desktop.js')) && existsSync(join(distDir, 'renderer.js'))) return

  console.log('Fetching the latest Fluenta mod from GitHub Releases…')
  const release = await fetchLatestRelease()
  if (!release) throw new Error('No Fluenta release found on GitHub yet.')

  const latest = release.tag_name.replace(/^v/i, '')
  for (const name of ['desktop.js', 'renderer.js']) {
    const asset = release.assets.find((item) => item.name === name)
    if (!asset) throw new Error(`Release ${latest} does not include ${name}.`)
    await downloadTo(asset.browser_download_url, join(distDir, name))
  }
  version = latest
  console.log(`Got mod ${latest}.`)
}

async function install(): Promise<boolean> {
  const installs = targets()
  if (installs.length === 0) {
    console.error('No Discord installation found. Pass --dir "<path to Discord resources>".')
    return false
  }
  await ensureBundles()

  let ok = true
  for (const target of installs) {
    try {
      const result = installInto(target, { distDir, version, dryRun })
      console.log(`${target.label}: ${result.status}`)
      console.log(`  ${result.message}`)
      if (result.status === 'conflict' || result.status === 'missing-asar') ok = false
    } catch (error) {
      ok = false
      console.error(`${target.label}: failed — ${(error as Error).message}`)
    }
  }
  if (ok && !dryRun) console.log('\nDone. Fully quit Discord (tray → Quit) and start it again.')
  return ok
}

function uninstall(): boolean {
  const installs = targets()
  if (installs.length === 0) {
    console.log('No Discord installation found.')
    return false
  }
  for (const target of installs) {
    console.log(`${target.label}: ${uninstallFrom(target).message}`)
  }
  return true
}

async function update(): Promise<boolean> {
  const release = await fetchLatestRelease()
  if (!release) {
    console.error('No Fluenta release published yet — nothing to update to.')
    return false
  }
  const latest = release.tag_name.replace(/^v/i, '')
  mkdirSync(distDir, { recursive: true })
  for (const name of ['desktop.js', 'renderer.js']) {
    const asset = release.assets.find((item) => item.name === name)
    if (!asset) {
      console.error(`Release ${latest} does not include ${name}; aborting.`)
      return false
    }
    await downloadTo(asset.browser_download_url, join(distDir, name))
    console.log(`Downloaded ${name}`)
  }
  version = latest

  for (const target of targets()) {
    if (isInstalled(target)) uninstallFrom(target)
    const result = installInto(target, { distDir, version: latest })
    console.log(`${target.label}: ${result.status}`)
  }
  console.log('Restart Discord to run the updated mod.')
  return true
}

async function menu(): Promise<void> {
  console.log(`\nFluenta — Discord client mod installer v${MOD_VERSION}`)
  console.log('No account token needed: this patches the Discord you already use.\n')

  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    for (;;) {
      console.log('  1) Install / repair')
      console.log('  2) Uninstall')
      console.log('  3) Update to the latest release')
      console.log('  4) Status')
      console.log('  5) Quit')
      const answer = (await rl.question('\nChoose [1-5]: ')).trim()

      if (answer === '5' || answer.toLowerCase() === 'q') break
      if (answer === '1') await install()
      else if (answer === '2') uninstall()
      else if (answer === '3') await update()
      else if (answer === '4') printStatus()
      else console.log('Enter 1-5.')
      console.log('')
    }
  } finally {
    rl.close()
  }
}

async function main(): Promise<void> {
  switch (command) {
    case 'install':
      if (!(await install())) process.exitCode = 1
      break
    case 'uninstall':
      if (!uninstall()) process.exitCode = 1
      break
    case 'update':
      if (!(await update())) process.exitCode = 1
      break
    case 'status':
      if (!printStatus()) process.exitCode = 1
      break
    case 'menu':
      await menu()
      break
    default:
      console.log(`Fluenta mod installer v${MOD_VERSION}

Usage:
  Fluenta-Mod-Setup.exe                 interactive menu
  Fluenta-Mod-Setup.exe install         patch every Discord install found
  Fluenta-Mod-Setup.exe uninstall       restore the original app.asar
  Fluenta-Mod-Setup.exe update          pull the newest mod build
  Fluenta-Mod-Setup.exe status          show detected installs

Options:
  --dir <path>   target a specific Discord resources folder
  --dry-run      report what would happen without changing files
`)
      if (!['help', '--help', '-h'].includes(command)) process.exitCode = 1
  }
}

void main().catch((error) => {
  console.error((error as Error).message)
  process.exitCode = 1
})
