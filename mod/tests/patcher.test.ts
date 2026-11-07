import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  __resetPatcherCache,
  eachFactory,
  findByProps,
  findBySource,
  getDispatcher,
  getWebpackRequire,
  subscribe,
} from '../src/renderer/patcher'

interface FakeDispatcher {
  dispatch: (action: { type: string }) => void
  subscribe: (type: string, handler: (payload: unknown) => void) => void
  unsubscribe: (type: string, handler: (payload: unknown) => void) => void
  isDispatching: () => boolean
  _actionHandlers: Record<string, unknown>
}

/**
 * Mirrors the shape of Discord's webpack chunk array: [chunkId, moduleMap, runtime].
 * The runtime callback is how modules get handed to the mod.
 */
function installFakeDiscord() {
  const handlers: Record<string, ((payload: unknown) => void)[]> = {}
  const dispatcher: FakeDispatcher = {
    dispatch(action) {
      for (const handler of handlers[action.type] ?? []) handler(action)
    },
    subscribe(type, handler) {
      ;(handlers[type] ??= []).push(handler)
    },
    unsubscribe(type, handler) {
      handlers[type] = (handlers[type] ?? []).filter((entry) => entry !== handler)
    },
    isDispatching: () => false,
    _actionHandlers: {},
  }

  const modules: Record<string, (module: { exports: unknown }) => void> = {
    './dispatcher': (module) => {
      module.exports = dispatcher
    },
    './constants': (module) => {
      module.exports = { MAX_MESSAGE_LENGTH: 2000 }
    },
    './broken': () => {
      throw new Error('module exploded')
    },
  }

  const cache: Record<string, { exports: unknown }> = {}
  const requireModule = ((id: string) => {
    if (!cache[id]) {
      const module = { exports: {} }
      cache[id] = module
      modules[id](module)
    }
    return cache[id].exports
  }) as unknown as Record<string, unknown> & {
    c: Record<string, { exports: unknown }>
  }
  requireModule.c = cache

  const chunks: unknown[] = [
    [0, modules, () => {}],
  ]
  ;(chunks as unknown as { push: (entry: unknown[]) => number }).push = (entry) => {
    // Our patcher pushes [[symbol], {}, runtime] to capture __webpack_require__.
    ;(entry[2] as (req: unknown) => void)(requireModule)
    return chunks.length
  }

  ;(globalThis as unknown as { window: unknown }).window = {
    webpackChunkdiscord_app: chunks,
  }

  __resetPatcherCache()
  return { dispatcher, handlers }
}

test('getWebpackRequire captures the runtime from the chunk array', () => {
  installFakeDiscord()
  const runtime = getWebpackRequire()
  assert.equal(typeof runtime, 'function')
})

test('eachFactory walks every pushed module, including unloaded ones', () => {
  installFakeDiscord()
  const ids: string[] = []
  eachFactory((id) => ids.push(id))
  assert.deepEqual(ids.sort(), ['./broken', './constants', './dispatcher'])
})

test('findByProps resolves a module by its export shape', () => {
  installFakeDiscord()
  const found = findByProps<FakeDispatcher>(
    'dispatch',
    'subscribe',
    'unsubscribe',
    '_actionHandlers',
  )
  assert.ok(found)
  assert.equal(typeof found.subscribe, 'function')
})

test('a throwing module does not break discovery', () => {
  installFakeDiscord()
  const matches = findBySource(/exploded/)
  assert.equal(matches.length, 0)
  assert.ok(findByProps('MAX_MESSAGE_LENGTH'))
})

test('getDispatcher and subscribe deliver real Flux actions', () => {
  const { dispatcher } = installFakeDiscord()
  assert.equal(getDispatcher(), dispatcher)

  const received: unknown[] = []
  const off = subscribe('MESSAGE_DELETE', (payload) => received.push(payload))
  dispatcher.dispatch({ type: 'MESSAGE_DELETE' })
  assert.equal(received.length, 1)

  off()
  dispatcher.dispatch({ type: 'MESSAGE_DELETE' })
  assert.equal(received.length, 1, 'unsubscribe must stop delivery')
})

test('subscribe throws a useful error when the dispatcher is absent', () => {
  // A working webpack runtime that simply has no Flux dispatcher module.
  const chunks: unknown[] = [[0, { './ui': (module: { exports: unknown }) => { module.exports = { open: true } } }, () => {}]]
  ;(chunks as unknown as { push: (entry: unknown[]) => number }).push = (entry) => {
    ;(entry[2] as (req: unknown) => void)(() => ({}))
    return chunks.length
  }
  ;(globalThis as unknown as { window: unknown }).window = { webpackChunkdiscord_app: chunks }
  __resetPatcherCache()
  assert.throws(() => subscribe('MESSAGE_CREATE', () => {}), /dispatcher not found/)
})
