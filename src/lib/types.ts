/** Subset of Discord API object shapes that this client actually reads. */

export type Snowflake = string

export interface User {
  id: Snowflake
  username: string
  discriminator: string
  global_name?: string | null
  avatar: string | null
  bot?: boolean
  system?: boolean
}

export interface Guild {
  id: Snowflake
  name: string
  icon: string | null
  owner?: boolean
  permissions?: string
  features?: string[]
  unavailable?: boolean
}

export interface PermissionOverwrite {
  id: Snowflake
  type: number
  allow: string
  deny: string
}

export interface Channel {
  id: Snowflake
  type: number
  guild_id?: Snowflake
  name?: string
  topic?: string | null
  position?: number
  parent_id?: Snowflake | null
  recipients?: User[]
  last_message_id?: Snowflake | null
  permission_overwrites?: PermissionOverwrite[]
  nsfw?: boolean
}

export const CHANNEL = {
  TEXT: 0,
  DM: 1,
  VOICE: 2,
  GROUP_DM: 3,
  CATEGORY: 4,
  ANNOUNCEMENT: 5,
  STORE: 6,
  ANNOUNCEMENT_THREAD: 10,
  PUBLIC_THREAD: 11,
  PRIVATE_THREAD: 12,
  STAGE: 13,
  DIRECTORY: 14,
  FORUM: 15,
} as const

export interface Attachment {
  id: Snowflake
  filename: string
  description?: string | null
  size: number
  url: string
  proxy_url?: string
  content_type?: string
  width?: number | null
  height?: number | null
}

export interface Emoji {
  id?: Snowflake | null
  name: string | null
  animated?: boolean
}

export interface Reaction {
  count: number
  me: boolean
  emoji: Emoji
}

export interface Embed {
  title?: string
  description?: string
  url?: string
  type?: string
  color?: number
  timestamp?: string
  author?: { name: string; url?: string; icon_url?: string }
  footer?: { text: string; icon_url?: string }
  image?: { url: string; width?: number; height?: number }
  thumbnail?: { url: string }
  fields?: { name: string; value: string; inline?: boolean }[]
  provider?: { name?: string }
}

export interface Message {
  id: Snowflake
  channel_id: Snowflake
  guild_id?: Snowflake
  author: User
  member?: { nick?: string | null; roles?: string[]; avatar?: string | null }
  content: string
  timestamp: string
  edited_timestamp: string | null
  attachments: Attachment[]
  embeds: Embed[]
  mentions: User[]
  mention_roles?: Snowflake[]
  reactions?: Reaction[]
  type: number
  referenced_message?: Message | null
  pinned?: boolean
}

export interface Member {
  user: User
  nick?: string | null
  roles: Snowflake[]
  joined_at: string
  avatar?: string | null
  premium_since?: string | null
}

export interface TypingEntry {
  id: Snowflake
  name: string
  at: number
}
