import { injectStyle } from '../util'
import type { PluginDefinition } from './registry'

const STYLE = `
.fluenta-keyword-hit {
  background: rgba(245, 165, 36, 0.18);
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(245, 165, 36, 0.35);
}
`

const parseKeywords = (raw: string) =>
  raw
    .split(',')
    .map((word) => word.trim().toLowerCase())
    .filter(Boolean)

export const keywordHighlightPlugin: PluginDefinition = {
  id: 'keywordHighlight',
  name: 'Keyword highlight',
  description:
    'Tints any message that contains one of your keywords. Set them in the Plugins tab.',
  defaultEnabled: false,
  start(ctx) {
    const keywords = parseKeywords(ctx.getSetting<string>('keywords', 'fluenta'))
    if (keywords.length === 0) {
      ctx.warn('no keywords configured')
      return
    }

    const removeStyle = injectStyle('fluenta-keywords', STYLE)
    let scheduled = false

    const scan = () => {
      scheduled = false
      const nodes = document.querySelectorAll<HTMLElement>('[id^="message-content-"]')
      nodes.forEach((node) => {
        const text = (node.textContent ?? '').toLowerCase()
        const hit = keywords.some((keyword) => text.includes(keyword))
        node.classList.toggle('fluenta-keyword-hit', hit)
      })
    }

    const schedule = () => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(scan)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, { childList: true, subtree: true })
    schedule()

    ctx.log(`watching ${keywords.length} keyword(s)`)
    return () => {
      observer.disconnect()
      removeStyle()
      document
        .querySelectorAll('.fluenta-keyword-hit')
        .forEach((node) => node.classList.remove('fluenta-keyword-hit'))
    }
  },
}
