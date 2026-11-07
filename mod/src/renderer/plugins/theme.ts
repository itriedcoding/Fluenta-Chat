import { injectStyle } from '../util'
import type { PluginDefinition } from './registry'

export const THEME_KEY = 'css'

export const DEFAULT_CSS = `/*
 * Fluenta custom theme — plain CSS, applied live.
 * Discord's own classes are hashed, so prefer attribute selectors.
 */
:root {
  /* Example: softer corners and a red accent */
  --fluenta-accent: #ff5c7c;
}

[class*="messageContent"] a {
  text-decoration-thickness: 1px;
}
`

export function applyTheme(css: string): () => void {
  return injectStyle('fluenta-theme', css)
}

export const themePlugin: PluginDefinition = {
  id: 'theme',
  name: 'Custom theme',
  description: 'Injects your own CSS into Discord. Edit it from the Theme tab.',
  defaultEnabled: true,
  start(ctx) {
    const css = ctx.getSetting<string>(THEME_KEY, DEFAULT_CSS)
    ctx.log('theme applied')
    return applyTheme(css)
  },
}
