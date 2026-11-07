import { build } from 'esbuild'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const modDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(modDir, '..')
const dist = join(modDir, 'dist')
const testDist = join(modDir, 'dist-tests')

const withTests = process.argv.includes('--tests')

const base = {
  bundle: true,
  logLevel: 'info',
  absWorkingDir: root,
  legalComments: 'none',
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// Main-process loader (CommonJS, runs inside Discord's Electron main).
await build({
  ...base,
  entryPoints: [join(modDir, 'src/main/desktop.ts')],
  outfile: join(dist, 'desktop.js'),
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
})

// Renderer bundle (IIFE, injected with executeJavaScript).
await build({
  ...base,
  entryPoints: [join(modDir, 'src/renderer/index.ts')],
  outfile: join(dist, 'renderer.js'),
  platform: 'browser',
  format: 'iife',
  target: 'chrome110',
  minify: true,
})

// Installer CLI (CommonJS, run by the user with node).
await build({
  ...base,
  entryPoints: [join(modDir, 'src/cli.ts')],
  outfile: join(dist, 'cli.cjs'),
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['@electron/asar'],
})

console.log('Built mod/dist/{desktop.js, renderer.js, cli.cjs}')

if (withTests) {
  rmSync(testDist, { recursive: true, force: true })
  mkdirSync(testDist, { recursive: true })
  const entries = readdirSync(join(modDir, 'tests'))
    .filter((file) => file.endsWith('.test.ts'))
    .map((file) => join(modDir, 'tests', file))

  await build({
    ...base,
    entryPoints: entries,
    outdir: testDist,
    outExtension: { '.js': '.test.cjs' },
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    external: ['@electron/asar'],
  })
  console.log('Built mod/dist-tests')
}
