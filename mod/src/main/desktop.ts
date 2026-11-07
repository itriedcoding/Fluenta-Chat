/**
 * Fluenta main-process loader.
 *
 * Injected into Discord's main process by `mod/dist/cli.js install`, which
 * prepends a `require("./fluenta/desktop.js")` to Discord's app/index.js.
 * Its only job is to run the renderer bundle inside Discord's window once the
 * page has loaded.
 */
import { app, type WebContents } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const RENDERER_PATH = join(__dirname, 'renderer.js')

const inject = async (contents: WebContents) => {
  try {
    const source = readFileSync(RENDERER_PATH, 'utf8')
    await contents.executeJavaScript(source, true)
  } catch (error) {
    console.error('[Fluenta] renderer injection failed:', error)
  }
}

app.on('web-contents-created', (_event, contents) => {
  // Only Discord app windows; skip devtools, background pages and webviews.
  if (contents.getType() !== 'window') return

  contents.on('did-finish-load', () => {
    void inject(contents)
  })

  // A mod is a debugging tool: keep DevTools reachable.
  contents.on('before-input-event', (_event, input) => {
    const isF12 = input.key === 'F12'
    const isInspect =
      (input.control || input.meta) && input.shift && input.key.toLowerCase() === 'i'
    if (isF12 || isInspect) contents.openDevTools({ mode: 'detach' })
  })
})

console.log('[Fluenta] main-process loader active')
