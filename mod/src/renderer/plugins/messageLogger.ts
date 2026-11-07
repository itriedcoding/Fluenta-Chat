import type { PluginDefinition } from './registry'

export interface LoggedMessage {
  at: number
  kind: 'create' | 'edit' | 'delete'
  id: string
  channelId: string
  author: string
  authorId: string
  content: string
  /** For edits: what the message said before. */
  previous?: string
}

const STORE_KEY = 'fluenta.messageLog'
const LIMIT = 1000

const cache = new Map<string, { author: string; authorId: string; content: string }>()

export function getMessageLog(): LoggedMessage[] {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]') as LoggedMessage[]
  } catch {
    return []
  }
}

function append(entry: LoggedMessage) {
  const log = getMessageLog()
  log.push(entry)
  if (log.length > LIMIT) log.splice(0, log.length - LIMIT)
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(log))
  } catch {
    /* ignore quota */
  }
}

export function clearMessageLog() {
  cache.clear()
  try {
    localStorage.removeItem(STORE_KEY)
  } catch {
    /* ignore */
  }
}

export const messageLoggerPlugin: PluginDefinition = {
  id: 'messageLogger',
  name: 'Message logger',
  description:
    'Remembers messages Discord deletes or edits locally, so you can still read them. Stored on this device only.',
  defaultEnabled: false,
  start(ctx) {
    const unsubscribe = [
      ctx.subscribe('MESSAGE_CREATE', (payload: any) => {
        if (!payload?.message) return
        const message = payload.message
        cache.set(message.id, {
          author: message.author?.username ?? 'unknown',
          authorId: message.author?.id ?? '0',
          content: message.content ?? '',
        })
        if (cache.size > 4000) {
          const oldest = cache.keys().next().value
          if (oldest) cache.delete(oldest)
        }
      }),

      ctx.subscribe('MESSAGE_UPDATE', (payload: any) => {
        const message = payload?.message
        if (!message?.id) return
        const previous = cache.get(message.id)
        if (previous && message.content && previous.content !== message.content) {
          append({
            at: Date.now(),
            kind: 'edit',
            id: message.id,
            channelId: message.channel_id ?? payload.channelId ?? 'unknown',
            author: previous.author,
            authorId: previous.authorId,
            content: message.content,
            previous: previous.content,
          })
          previous.content = message.content
        }
        if (message.content) {
          cache.set(message.id, {
            author: message.author?.username ?? previous?.author ?? 'unknown',
            authorId: message.author?.id ?? previous?.authorId ?? '0',
            content: message.content,
          })
        }
      }),

      ctx.subscribe('MESSAGE_DELETE', (payload: any) => {
        if (!payload?.id) return
        const cached = cache.get(payload.id)
        if (!cached) return
        append({
          at: Date.now(),
          kind: 'delete',
          id: payload.id,
          channelId: payload.channel_id ?? 'unknown',
          author: cached.author,
          authorId: cached.authorId,
          content: cached.content,
        })
        cache.delete(payload.id)
      }),
    ]

    ctx.log('listening for message create/edit/delete')
    return () => unsubscribe.forEach((off) => off())
  },
}
