/**
 * Renderer entry, executed inside Discord's window by the main-process loader.
 * Boots the patcher, starts enabled plugins and mounts the Fluenta panel.
 */
import { error, log } from './log'
import { allPlugins } from './plugins'
import { startAll } from './plugins/registry'
import { mountPanel } from './ui'
import { waitForWebpack } from './util'

async function boot(): Promise<void> {
  const scope = window as any
  if (scope.__fluentaBooted) return
  scope.__fluentaBooted = true

  await waitForWebpack()
  log('Discord webpack module system detected')

  startAll(allPlugins)
  mountPanel()
  log('Fluenta is running — press Ctrl+Shift+F to open the panel')
}

void boot().catch((cause) => {
  error('Fluenta failed to boot', cause)
})
