import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createPackage, extractFile } from '@electron/asar'
import type { DiscordInstall } from '../src/shared/paths'
import {
  BACKUP_NAME,
  MARKER,
  installInto,
  isInstalled,
  patchIndexSource,
  uninstallFrom,
} from '../src/injector/install'

const ORIGINAL_INDEX = 'require("./core.js");\nconsole.log("discord main");\n'

interface Fixture {
  root: string
  resources: string
  dist: string
  install: DiscordInstall
}

/**
 * Builds a real asar archive with the same layout a Discord install has
 * (`resources/app.asar` containing index.js + package.json).
 */
async function fixture(): Promise<Fixture> {
  const root = mkdtempSync(join(tmpdir(), 'fluenta-test-'))
  const resources = join(root, 'resources')
  mkdirSync(resources, { recursive: true })

  const appSrc = join(root, 'app-src')
  mkdirSync(appSrc)
  writeFileSync(join(appSrc, 'index.js'), ORIGINAL_INDEX)
  writeFileSync(join(appSrc, 'core.js'), '/* discord core bundle */\n')
  writeFileSync(
    join(appSrc, 'package.json'),
    JSON.stringify({ name: 'discord', main: 'index.js' }),
  )
  await createPackage(appSrc, join(resources, 'app.asar'))

  const dist = join(root, 'dist')
  mkdirSync(dist)
  writeFileSync(join(dist, 'desktop.js'), '/* desktop bundle */')
  writeFileSync(join(dist, 'renderer.js'), '/* renderer bundle */')

  const install: DiscordInstall = {
    branch: 'stable',
    label: 'Discord (fixture)',
    appRoot: resources,
    resourcesDir: resources,
  }

  return { root, resources, dist, install }
}

test('patchIndexSource prepends the loader exactly once', () => {
  const once = patchIndexSource(ORIGINAL_INDEX)
  assert.ok(once.startsWith('/* Fluenta mod loader */'))
  assert.ok(once.includes('require("./fluenta/desktop.js")'))
  assert.ok(once.endsWith(ORIGINAL_INDEX))
  assert.equal(patchIndexSource(once), once)
})

test('install extracts the archive, patches index.js and keeps a backup', async () => {
  const { root, resources, dist, install } = await fixture()
  try {
    assert.equal(isInstalled(install), false)

    const result = installInto(install, { distDir: dist, version: '1.0.0' })
    assert.equal(result.status, 'installed')

    const patchDir = join(resources, 'app')
    assert.ok(existsSync(join(patchDir, MARKER)))
    assert.ok(existsSync(join(patchDir, 'fluenta', 'desktop.js')))
    assert.ok(existsSync(join(patchDir, 'fluenta', 'renderer.js')))
    assert.ok(existsSync(join(patchDir, 'core.js')))

    const patched = readFileSync(join(patchDir, 'index.js'), 'utf8')
    assert.ok(patched.includes('Fluenta mod loader'))
    assert.ok(patched.includes('discord main'))

    // Electron must no longer see the original archive.
    assert.equal(existsSync(join(resources, 'app.asar')), false)
    assert.ok(existsSync(join(resources, BACKUP_NAME)))
    assert.equal(isInstalled(install), true)

    const marker = JSON.parse(readFileSync(join(patchDir, MARKER), 'utf8')) as {
      version: string
    }
    assert.equal(marker.version, '1.0.0')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('second install is a no-op and uninstall restores the original archive', async () => {
  const { root, resources, dist, install } = await fixture()
  try {
    assert.equal(installInto(install, { distDir: dist, version: '1.0.0' }).status, 'installed')
    assert.equal(
      installInto(install, { distDir: dist, version: '1.0.0' }).status,
      'already-installed',
    )

    const result = uninstallFrom(install)
    assert.match(result.message, /restored/)
    assert.equal(existsSync(join(resources, 'app')), false)
    assert.ok(existsSync(join(resources, 'app.asar')))

    const restored = extractFile(join(resources, 'app.asar'), 'index.js').toString()
    assert.equal(restored, ORIGINAL_INDEX)
    assert.equal(isInstalled(install), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('install refuses to clobber a foreign resources/app directory', async () => {
  const { root, resources, dist, install } = await fixture()
  try {
    mkdirSync(join(resources, 'app'))
    writeFileSync(join(resources, 'app', 'index.js'), '// someone else')
    const result = installInto(install, { distDir: dist, version: '1.0.0' })
    assert.equal(result.status, 'conflict')
    assert.equal(readFileSync(join(resources, 'app', 'index.js'), 'utf8'), '// someone else')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('dry run reports without touching the installation', async () => {
  const { root, resources, dist, install } = await fixture()
  try {
    const result = installInto(install, { distDir: dist, version: '1.0.0', dryRun: true })
    assert.equal(result.status, 'dry-run')
    assert.ok(existsSync(join(resources, 'app.asar')))
    assert.equal(existsSync(join(resources, 'app')), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
