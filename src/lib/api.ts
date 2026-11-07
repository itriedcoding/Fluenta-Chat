import { request } from './transport'
import type {
  Channel,
  Guild,
  Member,
  Message,
  Snowflake,
  User,
} from './types'

const BASE = 'https://discord.com/api/v10'

export class DiscordError extends Error {
  status: number
  code?: number | string

  constructor(message: string, status: number, code?: number | string) {
    super(message)
    this.name = 'DiscordError'
    this.status = status
    this.code = code
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class Rest {
  constructor(private token: string) {}

  setToken(token: string) {
    this.token = token
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: this.token,
    }
  }

  async req<T>(
    method: string,
    path: string,
    body?: unknown,
    attempt = 0,
  ): Promise<T> {
    const res = await request(BASE + path, {
      method,
      headers: this.headers(),
      body: body === undefined ? undefined : JSON.stringify(body),
    })

    if (res.status === 429 && attempt < 5) {
      let waitMs = 1000
      try {
        const info = (await res.json()) as { retry_after?: number }
        if (typeof info?.retry_after === 'number') waitMs = info.retry_after * 1000
      } catch {
        const header = res.headers.get('retry-after')
        if (header) waitMs = Number(header) * 1000
      }
      await sleep(Math.max(waitMs, 250) + 120)
      return this.req<T>(method, path, body, attempt + 1)
    }

    if (res.status === 204) return undefined as T

    const text = await res.text()
    let data: unknown = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = text
      }
    }

    if (!res.ok) {
      const err = (data ?? {}) as { message?: string; code?: number | string }
      throw new DiscordError(
        err.message ?? `Discord request failed (HTTP ${res.status})`,
        res.status,
        err.code,
      )
    }

    return data as T
  }

  me() {
    return this.req<User>('GET', '/users/@me')
  }

  myGuilds() {
    return this.req<Guild[]>('GET', '/users/@me/guilds')
  }

  guild(guildId: Snowflake) {
    return this.req<Guild>('GET', `/guilds/${guildId}`)
  }

  guildChannels(guildId: Snowflake) {
    return this.req<Channel[]>('GET', `/guilds/${guildId}/channels`)
  }

  myDmChannels() {
    return this.req<Channel[]>('GET', '/users/@me/channels')
  }

  messages(channelId: Snowflake, before?: Snowflake, limit = 50) {
    const q = new URLSearchParams({ limit: String(limit) })
    if (before) q.set('before', before)
    return this.req<Message[]>('GET', `/channels/${channelId}/messages?${q}`)
  }

  sendMessage(channelId: Snowflake, content: string, replyTo?: Snowflake) {
    const body: Record<string, unknown> = { content }
    if (replyTo) {
      body.message_reference = { message_id: replyTo, channel_id: channelId }
    }
    return this.req<Message>('POST', `/channels/${channelId}/messages`, body)
  }

  editMessage(channelId: Snowflake, messageId: Snowflake, content: string) {
    return this.req<Message>('PATCH', `/channels/${channelId}/messages/${messageId}`, {
      content,
    })
  }

  deleteMessage(channelId: Snowflake, messageId: Snowflake) {
    return this.req<void>('DELETE', `/channels/${channelId}/messages/${messageId}`)
  }

  /** The typing indicator lasts ~10s server-side; callers throttle. */
  typing(channelId: Snowflake) {
    return this.req<void>('POST', `/channels/${channelId}/typing`)
  }

  addReaction(channelId: Snowflake, messageId: Snowflake, emoji: string) {
    return this.req<void>(
      'PUT',
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    )
  }

  removeReaction(channelId: Snowflake, messageId: Snowflake, emoji: string) {
    return this.req<void>(
      'DELETE',
      `/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(emoji)}/@me`,
    )
  }

  guildMembers(guildId: Snowflake, limit = 100, after?: Snowflake) {
    const q = new URLSearchParams({ limit: String(limit) })
    if (after) q.set('after', after)
    return this.req<Member[]>('GET', `/guilds/${guildId}/members?${q}`)
  }
}
