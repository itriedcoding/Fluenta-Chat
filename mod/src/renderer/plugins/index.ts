import type { PluginDefinition } from './registry'
import { hideNitroPlugin } from './hideNitro'
import { keywordHighlightPlugin } from './keywordHighlight'
import { messageLoggerPlugin } from './messageLogger'
import { themePlugin } from './theme'

export const allPlugins: PluginDefinition[] = [
  themePlugin,
  hideNitroPlugin,
  messageLoggerPlugin,
  keywordHighlightPlugin,
]
