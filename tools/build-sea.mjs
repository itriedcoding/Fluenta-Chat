#!/usr/bin/env node
/**
 * Packages the mod installer as a single executable using Node's SEA
 * (single executable application) support, so Windows users get a double-click
 * .exe with no Node install.
 *
 *   node tools/build-sea.mjs           # Windows .exe (works from Linux/macOS too)
 *   node tools/build-sea.mjs --linux   # local binary, used as a self-test
 */
import { execFileSync, execSync } from 'node:child_process'
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const dist = join(root, 'mod', 'dist')
const outDir = join(root, 'release')
const nodeVersion = 'v22.11.0'

const buildLinux = process.argv.includes('--linux')
const baseSize = (path) => statSync(path).size

if (!existsSync(join(dist, 'sea-main.cjs'))) {
  console.error('mod/dist/sea-main.cjs missing — run `npm run mod:build` first.')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

// 1. Bake the bundled CLI into a SEA blob (platform independent).
const seaConfig = {
  main: 'sea-main.cjs',
  output: 'sea-prep.blob',
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
}
writeFileSync(join(dist, 'sea-config.json'), JSON.stringify(seaConfig, null, 2))
execFileSync(process.execPath, ['--experimental-sea-config', 'sea-config.json'], {
  cwd: dist,
  stdio: 'inherit',
})

const blobPath = join(dist, 'sea-prep.blob')
const blobSize = baseSize(blobPath)
console.log(`SEA blob: ${blobSize} bytes`)

// 2. Get the Node binary for the target.
async function binaryFor(target) {
  if (target === 'linux' && process.platform === 'linux') return process.execPath
  if (target === 'win32' && process.platform === 'win32') return process.execPath

  if (target === 'win32') {
    const cache = join(outDir, 'node.exe')
    if (existsSync(cache) && baseSize(cache) > 1_000_000) return cache
    const url = `https://nodejs.org/dist/${nodeVersion}/win-x64/node.exe`
    console.log(`Downloading ${url}`)
    const response = await fetch(url)
    if (!response.ok || !response.body) throw new Error(`Download failed (HTTP ${response.status})`)
    await pipeline(Readable.fromWeb(response.body), createWriteStream(cache))
    return cache
  }

  throw new Error(`Cannot obtain a ${target} node binary on ${process.platform}`)
}

async function packageFor(target) {
  const outputName = target === 'win32' ? 'Fluenta-Mod-Setup.exe' : 'fluenta-mod-linux'
  const output = join(outDir, outputName)
  const binary = await binaryFor(target)
  const before = baseSize(binary)

  copyFileSync(binary, output)

  // 3. Inject the blob section + fuse into the executable.
  const postject = join(
    root,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'postject.cmd' : 'postject',
  )
  execSync(
    `"${postject}" "${output}" NODE_SEA_BLOB "${blobPath}" --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`,
    { stdio: 'inherit' },
  )

  const after = baseSize(output)
  const contents = readFileSync(output)
  const hasBlob = contents.includes(Buffer.from('NODE_SEA_BLOB'))

  console.log(
    `${outputName}: ${after} bytes (node ${before} + blob ${blobSize}), NODE_SEA_BLOB present: ${hasBlob}`,
  )
  if (!hasBlob) throw new Error('postject did not add the blob section')
  if (after <= before) throw new Error('output is not larger than the node binary')

  return output
}

const produced = []
if (buildLinux) produced.push(await packageFor('linux'))
produced.push(await packageFor('win32'))

// Self-test: the Linux build must actually run the installer.
if (buildLinux) {
  const linuxBin = produced.find((path) => path.endsWith('fluenta-mod-linux'))
  if (linuxBin) {
    const help = execFileSync(linuxBin, ['help'], { encoding: 'utf8' })
    if (!help.includes('Fluenta mod installer')) {
      throw new Error('Linux SEA binary did not print the installer help')
    }
    console.log('\nSelf-test: linux SEA binary ran successfully\n' + help.trim().split('\n')[0])
  }
}

console.log('\nArtifacts in release/')
for (const path of produced) console.log(`  ${path}`)
