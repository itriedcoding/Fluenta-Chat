import { injectStyle } from '../util'
import type { PluginDefinition } from './registry'

/**
 * Removes Nitro/Store advertising surfaces. Pure CSS using stable aria labels
 * and prefix-matched hashed class names so it survives Discord updates.
 */
const CSS = `
[aria-label="Nitro"],
[aria-label="Send a gift"],
[class*="nitroButton"],
[class*="premiumPromo"],
[class*="premiumTrial"],
[class*="upsellContainer"],
[class*="giftButton"],
[class*="sidebar"] [class*="premium"],
[class*="shopButton"] {
  display: none !important;
}
`

export const hideNitroPlugin: PluginDefinition = {
  id: 'hideNitro',
  name: 'Hide Nitro upsells',
  description: 'Hides gift, shop and Nitro promotion buttons from the UI.',
  defaultEnabled: true,
  start(ctx) {
    ctx.log('nitro surfaces hidden')
    return injectStyle('fluenta-hide-nitro', CSS)
  },
}
