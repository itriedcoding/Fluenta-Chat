import type { Channel, Emoji, Guild, Member, User } from './types'

const CDN = 'https://cdn.discordapp.com'

const safeIndex = (id: string): number => {
  try {
    return Number((BigInt(id) >> 22n) % 6n)
  } catch {
    return 0
  }
}

export function avatarUrl(
  user: User,
  size = 64,
  guildId?: string,
  memberAvatar?: string | null,
): string {
  if (guildId && memberAvatar) {
    const ext = memberAvatar.startsWith('a_') ? 'gif' : 'png'
    return `${CDN}/guilds/${guildId}/users/${user.id}/avatars/${memberAvatar}.${ext}?size=${size}`
  }
  if (user.avatar) {
    const ext = user.avatar.startsWith('a_') ? 'gif' : 'png'
    return `${CDN}/avatars/${user.id}/${user.avatar}.${ext}?size=${size}`
  }
  return `${CDN}/embed/avatars/${safeIndex(user.id)}.png`
}

export function guildIconUrl(guild: Guild, size = 96): string | null {
  if (!guild.icon) return null
  const ext = guild.icon.startsWith('a_') ? 'gif' : 'png'
  return `${CDN}/icons/${guild.id}/${guild.icon}.${ext}?size=${size}`
}

export function emojiUrl(emoji: Emoji, size = 32): string | null {
  if (!emoji.id) return null
  return `${CDN}/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=${size}`
}

export const displayName = (user: User): string => user.global_name || user.username

export const memberName = (member: Member): string =>
  member.nick || member.user.global_name || member.user.username

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

/** Deterministic accent per id, used for guild icons without an image. */
export function hueFor(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 360
  return hash
}

export function channelLabel(channel: Channel): string {
  if (channel.type === 1) {
    return channel.recipients?.map(displayName).join(', ') ?? 'Direct message'
  }
  if (channel.type === 3) {
    const names = (channel.recipients ?? []).map(displayName)
    return channel.name || names.join(', ') || 'Group'
  }
  return channel.name ?? 'unknown-channel'
}

const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })
const fullFmt = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const dayFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

export const formatTime = (iso: string) => timeFmt.format(new Date(iso))
export const formatFull = (iso: string) => fullFmt.format(new Date(iso))
export const formatDay = (iso: string) => dayFmt.format(new Date(iso))

export function sameDay(a: string, b: string): boolean {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  )
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hours = Math.floor(min / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatFull(iso)
}

export function sortSnowflakes(a: string, b: string): number {
  try {
    const diff = BigInt(a) - BigInt(b)
    return diff < 0n ? -1 : diff > 0n ? 1 : 0
  } catch {
    return a.localeCompare(b)
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
