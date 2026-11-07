import { create } from 'zustand'
import { DiscordError, Rest } from './api'
import { Gateway, type GatewayStatus } from './gateway'
import type {
  Channel,
  Guild,
  Member,
  Message,
  Snowflake,
  TypingEntry,
  User,
} from './types'
import { CHANNEL } from './types'
import {
  clearToken,
  defaultSettings,
  loadSettings,
  loadToken,
  saveSettings,
  saveToken,
  type Settings,
} from './storage'
import { sortSnowflakes } from './ui'

export type AuthStatus = 'idle' | 'connecting' | 'ready' | 'error'
export type MobilePane = 'channels' | 'chat'

export interface ReplyTarget {
  messageId: Snowflake
  channelId: Snowflake
  author: string
  content: string
}

interface Actions {
  login: (token: string) => Promise<void>
  logout: () => void
  selectGuild: (guildId: string | null) => Promise<void>
  selectChannel: (channelId: string) => Promise<void>
  loadMessages: (channelId: string) => Promise<void>
  loadMoreMessages: (channelId: string) => Promise<void>
  loadMembers: (guildId: string) => Promise<void>
  sendMessage: (content: string) => Promise<void>
  startTyping: (channelId: string) => Promise<void>
  toggleReaction: (message: Message, emoji: string) => Promise<void>
  editMessage: (message: Message, content: string) => Promise<void>
  deleteMessage: (message: Message) => Promise<void>
  setReply: (target: ReplyTarget | null) => void
  updateSettings: (patch: Partial<Settings>) => void
  setMobilePane: (pane: MobilePane) => void
  resolveChannelName: (id: string) => string | null
  resolveUserName: (id: string) => string | null
  resolveRoleName: (id: string) => string | null
  clearError: () => void
}

export interface AppState extends Actions {
  token: string | null
  me: User | null
  status: AuthStatus
  gateway: GatewayStatus
  error: string | null

  guilds: Guild[]
  channelsByGuild: Record<string, Channel[]>
  channelIndex: Record<string, Channel>
  dmChannels: Channel[]
  rolesByGuild: Record<string, Record<string, { name: string; color: number }>>
  membersByGuild: Record<string, Member[]>
  users: Record<string, User>

  messagesByChannel: Record<string, Message[]>
  hasMore: Record<string, boolean>
  loadingMessages: Record<string, boolean>
  typingByChannel: Record<string, TypingEntry[]>
  unread: Record<string, number>

  selectedGuildId: string | null
  selectedChannelId: string | null
  reply: ReplyTarget | null
  mobilePane: MobilePane
  settings: Settings
}

let rest: Rest | null = null
let gateway: Gateway | null = null
const typingSentAt: Record<string, number> = {}

const sortChannels = (channels: Channel[]) =>
  [...channels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

const isTextLike = (channel: Channel) =>
  channel.type === CHANNEL.TEXT ||
  channel.type === CHANNEL.ANNOUNCEMENT ||
  channel.type === CHANNEL.FORUM

const upsertMessage = (list: Message[], message: Message): Message[] => {
  const existing = list.findIndex((m) => m.id === message.id)
  if (existing >= 0) {
    const next = [...list]
    next[existing] = { ...next[existing], ...message }
    return next
  }
  return [...list, message].sort((a, b) => sortSnowflakes(a.id, b.id))
}

export const useApp = create<AppState>((set, get) => {
  const requireRest = (): Rest => {
    if (!rest) throw new Error('Not authenticated')
    return rest
  }

  const ingestUsers = (users: (User | undefined)[]) => {
    const found: Record<string, User> = {}
    for (const user of users) {
      if (user) found[user.id] = user
    }
    if (Object.keys(found).length === 0) return
    set((state) => ({
      users: { ...state.users, ...found },
    }))
  }

  const addMessage = (message: Message) => {
    ingestUsers([message.author])
    set((state) => {
      const current = state.messagesByChannel[message.channel_id]
      if (!current) {
        // Channel history not opened yet; nothing to splice into.
        return {
          unread:
            message.channel_id === state.selectedChannelId
              ? state.unread
              : {
                  ...state.unread,
                  [message.channel_id]: (state.unread[message.channel_id] ?? 0) + 1,
                },
        }
      }
      return {
        messagesByChannel: {
          ...state.messagesByChannel,
          [message.channel_id]: upsertMessage(current, message),
        },
        unread:
          message.channel_id === state.selectedChannelId
            ? state.unread
            : {
                ...state.unread,
                [message.channel_id]: (state.unread[message.channel_id] ?? 0) + 1,
              },
      }
    })
  }

  const patchReaction = (
    channelId: string,
    messageId: string,
    emojiKey: string,
    delta: 1 | -1,
    me: boolean,
  ) => {
    set((state) => {
      const list = state.messagesByChannel[channelId]
      if (!list) return {}
      const next = list.map((msg) => {
        if (msg.id !== messageId) return msg
        const reactions = [...(msg.reactions ?? [])]
        const key = (r: { emoji: { id?: string | null; name: string | null } }) =>
          r.emoji.id ?? r.emoji.name ?? ''
        const index = reactions.findIndex((r) => key(r) === emojiKey)
        if (index === -1) {
          if (delta < 0) return msg
          reactions.push({
            count: 1,
            me,
            emoji: { id: emojiKey.includes(':') ? emojiKey.split(':')[1] : null, name: emojiKey.split(':')[0] },
          })
        } else {
          const existing = reactions[index]
          const count = existing.count + delta
          if (count <= 0) reactions.splice(index, 1)
          else
            reactions[index] = {
              ...existing,
              count,
              me: me ? delta > 0 : existing.me && delta > 0 ? false : existing.me,
            }
        }
        return { ...msg, reactions }
      })
      return {
        messagesByChannel: { ...state.messagesByChannel, [channelId]: next },
      }
    })
  }

  const dispatch = (type: string, data: any) => {
    const state = get()
    switch (type) {
      case 'READY': {
        ingestUsers([data.user])
        const guildStubs: Guild[] = (data.guilds ?? []).map(
          (g: { id: string; unavailable?: boolean }) => ({
            id: g.id,
            name: 'Loading…',
            icon: null,
            unavailable: g.unavailable,
          }),
        )
        set((s) => ({
          me: data.user,
          guilds: guildStubs.length ? guildStubs : s.guilds,
          status: 'ready',
          gateway: 'online',
        }))
        break
      }
      case 'GUILD_CREATE': {
        const guild = data as Guild & {
          channels?: Channel[]
          roles?: { id: string; name: string; color: number }[]
        }
        if (guild.unavailable) break
        const roles: Record<string, { name: string; color: number }> = {}
        for (const role of guild.roles ?? []) roles[role.id] = { name: role.name, color: role.color }
        set((s) => {
          const exists = s.guilds.some((g) => g.id === guild.id)
          const guilds = exists
            ? s.guilds.map((g) => (g.id === guild.id ? { ...g, ...guild } : g))
            : [...s.guilds, guild]
          const channels = sortChannels((guild.channels ?? []).filter(isTextLike))
          const index: Record<string, Channel> = {}
          for (const channel of [...channels, ...(guild.channels ?? [])]) index[channel.id] = channel
          return {
            guilds,
            channelsByGuild: { ...s.channelsByGuild, [guild.id]: channels },
            channelIndex: { ...s.channelIndex, ...index },
            rolesByGuild: { ...s.rolesByGuild, [guild.id]: roles },
          }
        })
        break
      }
      case 'GUILD_UPDATE': {
        const guild = data as Guild
        set((s) => ({
          guilds: s.guilds.map((g) => (g.id === guild.id ? { ...g, ...guild } : g)),
        }))
        break
      }
      case 'CHANNEL_CREATE':
      case 'CHANNEL_UPDATE': {
        const channel = data as Channel
        if (!channel.guild_id) break
        set((s) => {
          const existing = s.channelsByGuild[channel.guild_id!] ?? []
          const filtered = existing.filter((c) => c.id !== channel.id)
          const next = isTextLike(channel)
            ? sortChannels([...filtered, channel])
            : filtered
          return {
            channelsByGuild: { ...s.channelsByGuild, [channel.guild_id!]: next },
            channelIndex: { ...s.channelIndex, [channel.id]: channel },
          }
        })
        break
      }
      case 'CHANNEL_DELETE': {
        const channel = data as Channel
        if (!channel.guild_id) break
        set((s) => ({
          channelsByGuild: {
            ...s.channelsByGuild,
            [channel.guild_id!]: (s.channelsByGuild[channel.guild_id!] ?? []).filter(
              (c) => c.id !== channel.id,
            ),
          },
        }))
        break
      }
      case 'MESSAGE_CREATE': {
        addMessage(data as Message)
        if (data.channel_id === state.selectedChannelId && data.author?.id === state.me?.id) {
          rest?.typing(data.channel_id).catch(() => {})
        }
        break
      }
      case 'MESSAGE_UPDATE': {
        const message = data as Message
        set((s) => {
          const list = s.messagesByChannel[message.channel_id]
          if (!list) return {}
          return {
            messagesByChannel: {
              ...s.messagesByChannel,
              [message.channel_id]: list.map((m) =>
                m.id === message.id ? { ...m, ...message } : m,
              ),
            },
          }
        })
        break
      }
      case 'MESSAGE_DELETE': {
        const { channel_id, id } = data as { channel_id: string; id: string }
        set((s) => {
          const list = s.messagesByChannel[channel_id]
          if (!list) return {}
          return {
            messagesByChannel: {
              ...s.messagesByChannel,
              [channel_id]: list.filter((m) => m.id !== id),
            },
          }
        })
        break
      }
      case 'MESSAGE_REACTION_ADD': {
        const emoji = data.emoji as { id?: string | null; name: string | null }
        patchReaction(
          data.channel_id,
          data.message_id,
          emoji.id ? `${emoji.name}:${emoji.id}` : (emoji.name ?? ''),
          1,
          data.user_id === state.me?.id,
        )
        break
      }
      case 'MESSAGE_REACTION_REMOVE': {
        const emoji = data.emoji as { id?: string | null; name: string | null }
        patchReaction(
          data.channel_id,
          data.message_id,
          emoji.id ? `${emoji.name}:${emoji.id}` : (emoji.name ?? ''),
          -1,
          data.user_id === state.me?.id,
        )
        break
      }
      case 'TYPING_START': {
        const channelId = data.channel_id as string
        const userId = data.user_id as string
        if (!channelId || !userId) break
        const name = state.users[userId]
          ? state.users[userId].global_name || state.users[userId].username
          : 'Someone'
        set((s) => {
          const current = (s.typingByChannel[channelId] ?? []).filter((t) => t.id !== userId)
          return {
            typingByChannel: {
              ...s.typingByChannel,
              [channelId]: [...current, { id: userId, name, at: Date.now() }],
            },
          }
        })
        window.setTimeout(() => {
          set((s) => ({
            typingByChannel: {
              ...s.typingByChannel,
              [channelId]: (s.typingByChannel[channelId] ?? []).filter(
                (t) => Date.now() - t.at < 9000,
              ),
            },
          }))
        }, 9500)
        break
      }
      default:
        break
    }
  }

  return {
    token: null,
    me: null,
    status: 'idle',
    gateway: 'offline',
    error: null,

    guilds: [],
    channelsByGuild: {},
    channelIndex: {},
    dmChannels: [],
    rolesByGuild: {},
    membersByGuild: {},
    users: {},

    messagesByChannel: {},
    hasMore: {},
    loadingMessages: {},
    typingByChannel: {},
    unread: {},

    selectedGuildId: null,
    selectedChannelId: null,
    reply: null,
    mobilePane: 'channels',
    settings: loadSettings(),

    async login(token) {
      const clean = token.trim()
      if (!clean) {
        set({ status: 'error', error: 'Enter your Discord token first.' })
        return
      }
      gateway?.stop()
      gateway = null
      set({ status: 'connecting', error: null, gateway: 'connecting' })
      try {
        const client = new Rest(clean)
        const me = await client.me()
        rest = client
        saveToken(clean)
        set({
          token: clean,
          me,
          status: 'ready',
          gateway: 'connecting',
          users: { [me.id]: me },
          messagesByChannel: {},
          channelsByGuild: {},
          channelIndex: {},
          unread: {},
          selectedGuildId: null,
          selectedChannelId: null,
        })

        const [guilds, dms] = await Promise.all([
          client.myGuilds(),
          client.myDmChannels(),
        ])
        set({
          guilds,
          dmChannels: sortChannels(dms),
          channelIndex: Object.fromEntries(dms.map((c) => [c.id, c])),
        })

        gateway = new Gateway({
          token: clean,
          onEvent: dispatch,
          onStatus: (status) => set({ gateway: status }),
          onFatal: (reason) => {
            set({ status: 'error', error: reason })
            rest = null
            clearToken()
          },
        })
        gateway.start()
      } catch (error) {
        rest = null
        const message =
          error instanceof DiscordError
            ? error.status === 401
              ? 'Discord rejected that token (401 Unauthorized).'
              : `Discord error ${error.status}: ${error.message}`
            : error instanceof Error
              ? error.message
              : 'Could not reach Discord.'
        set({ status: 'error', error: message, gateway: 'offline' })
      }
    },

    logout() {
      gateway?.stop()
      gateway = null
      rest = null
      clearToken()
      set({
        token: null,
        me: null,
        status: 'idle',
        gateway: 'offline',
        error: null,
        guilds: [],
        channelsByGuild: {},
        channelIndex: {},
        dmChannels: [],
        membersByGuild: {},
        rolesByGuild: {},
        users: {},
        messagesByChannel: {},
        hasMore: {},
        loadingMessages: {},
        typingByChannel: {},
        unread: {},
        selectedGuildId: null,
        selectedChannelId: null,
        reply: null,
        mobilePane: 'channels',
      })
    },

    async selectGuild(guildId) {
      set({ selectedGuildId: guildId, reply: null })
      if (!guildId) return
      const state = get()
      if (!state.channelsByGuild[guildId]) {
        try {
          const channels = sortChannels(
            (await requireRest().guildChannels(guildId)).filter(isTextLike),
          )
          set((s) => ({
            channelsByGuild: { ...s.channelsByGuild, [guildId]: channels },
            channelIndex: {
              ...s.channelIndex,
              ...Object.fromEntries(channels.map((c) => [c.id, c])),
            },
          }))
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Could not load channels.' })
        }
      }
      if (!get().membersByGuild[guildId]) {
        void get().loadMembers(guildId)
      }
      const current = get().selectedChannelId
      const channels = get().channelsByGuild[guildId] ?? []
      const stillValid = channels.some((c) => c.id === current)
      if (!stillValid && channels[0] && window.innerWidth > 820) {
        await get().selectChannel(channels[0].id)
      }
    },

    async selectChannel(channelId) {
      set((s) => ({
        selectedChannelId: channelId,
        reply: null,
        mobilePane: 'chat',
        unread: { ...s.unread, [channelId]: 0 },
      }))
      if (!get().messagesByChannel[channelId]) {
        await get().loadMessages(channelId)
      }
    },

    async loadMessages(channelId) {
      if (get().loadingMessages[channelId]) return
      set((s) => ({
        loadingMessages: { ...s.loadingMessages, [channelId]: true },
      }))
      try {
        const batch = await requireRest().messages(channelId, undefined, 50)
        ingestUsers(batch.map((m) => m.author))
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: [...batch].sort((a, b) => sortSnowflakes(a.id, b.id)),
          },
          hasMore: { ...s.hasMore, [channelId]: batch.length === 50 },
        }))
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Could not load messages.' })
      } finally {
        set((s) => ({
          loadingMessages: { ...s.loadingMessages, [channelId]: false },
        }))
      }
    },

    async loadMoreMessages(channelId) {
      const state = get()
      if (state.loadingMessages[channelId] || !state.hasMore[channelId]) return
      const list = state.messagesByChannel[channelId] ?? []
      if (list.length === 0) return
      set((s) => ({
        loadingMessages: { ...s.loadingMessages, [channelId]: true },
      }))
      try {
        const batch = await requireRest().messages(channelId, list[0].id, 50)
        ingestUsers(batch.map((m) => m.author))
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [channelId]: [
              ...[...batch].sort((a, b) => sortSnowflakes(a.id, b.id)),
              ...(s.messagesByChannel[channelId] ?? []),
            ],
          },
          hasMore: { ...s.hasMore, [channelId]: batch.length === 50 },
        }))
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Could not load more messages.' })
      } finally {
        set((s) => ({
          loadingMessages: { ...s.loadingMessages, [channelId]: false },
        }))
      }
    },

    async loadMembers(guildId) {
      try {
        const members = await requireRest().guildMembers(guildId, 100)
        ingestUsers(members.map((m) => m.user))
        set((s) => ({ membersByGuild: { ...s.membersByGuild, [guildId]: members } }))
      } catch {
        // Missing GUILD_MEMBERS intent for bot tokens is expected; stay quiet.
      }
    },

    async sendMessage(content) {
      const { selectedChannelId, reply } = get()
      const body = content.trim()
      if (!selectedChannelId || !body) return
      const sent = await requireRest().sendMessage(
        selectedChannelId,
        body,
        reply?.messageId,
      )
      addMessage(sent)
      set({ reply: null })
    },

    async startTyping(channelId) {
      const now = Date.now()
      if (now - (typingSentAt[channelId] ?? 0) < 7000) return
      typingSentAt[channelId] = now
      try {
        await requireRest().typing(channelId)
      } catch {
        /* typing is best-effort */
      }
    },

    async toggleReaction(message, emoji) {
      const existing = message.reactions?.find(
        (r) => (r.emoji.id ?? r.emoji.name) === (emoji.includes(':') ? emoji.split(':')[1] : emoji),
      )
      try {
        if (existing?.me) {
          await requireRest().removeReaction(message.channel_id, message.id, emoji)
        } else {
          await requireRest().addReaction(message.channel_id, message.id, emoji)
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Reaction failed.' })
      }
    },

    async editMessage(message, content) {
      const body = content.trim()
      if (!body || body === message.content) return
      try {
        const updated = await requireRest().editMessage(
          message.channel_id,
          message.id,
          body,
        )
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [message.channel_id]: (s.messagesByChannel[message.channel_id] ?? []).map((m) =>
              m.id === updated.id ? { ...m, ...updated } : m,
            ),
          },
        }))
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Edit failed.' })
      }
    },

    async deleteMessage(message) {
      try {
        await requireRest().deleteMessage(message.channel_id, message.id)
        set((s) => ({
          messagesByChannel: {
            ...s.messagesByChannel,
            [message.channel_id]: (s.messagesByChannel[message.channel_id] ?? []).filter(
              (m) => m.id !== message.id,
            ),
          },
        }))
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Delete failed.' })
      }
    },

    setReply(target) {
      set({ reply: target })
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch }
      saveSettings(settings)
      set({ settings })
    },

    setMobilePane(pane) {
      set({ mobilePane: pane })
    },

    resolveChannelName(id) {
      const channel = get().channelIndex[id] ?? get().dmChannels.find((c) => c.id === id)
      if (!channel) return null
      if (channel.type === CHANNEL.DM) {
        return channel.recipients?.[0]?.username ?? null
      }
      return channel.name ?? null
    },

    resolveUserName(id) {
      const state = get()
      const user = state.users[id]
      if (user) return user.global_name || user.username
      if (state.me?.id === id) return state.me.username
      return null
    },

    resolveRoleName(id) {
      const state = get()
      for (const roles of Object.values(state.rolesByGuild)) {
        if (roles[id]) return roles[id].name
      }
      return null
    },

    clearError() {
      set({ error: null })
    },
  }
})

export const restoreSession = () => {
  const token = loadToken()
  if (token) void useApp.getState().login(token)
}

export const initialSettings = defaultSettings
