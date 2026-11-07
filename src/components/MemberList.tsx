import { useApp } from '../lib/store'
import { avatarUrl, channelLabel, formatTime, memberName } from '../lib/ui'
import type { Member } from '../lib/types'

function roleColor(member: Member, roles: Record<string, { name: string; color: number }>) {
  const colors = member.roles
    .map((id) => roles[id]?.color ?? 0)
    .filter((c) => c > 0)
    .sort((a, b) => b - a)
  return colors[0] ? `#${colors[0].toString(16).padStart(6, '0')}` : undefined
}

export default function MemberList() {
  const guildId = useApp((s) => s.selectedGuildId)
  const members = useApp((s) => (guildId ? s.membersByGuild[guildId] : undefined))
  const roles = useApp((s) => (guildId ? s.rolesByGuild[guildId] : undefined))
  const loadMembers = useApp((s) => s.loadMembers)
  const loading = useApp((s) => s.gateway)
  const selectedChannelId = useApp((s) => s.selectedChannelId)
  const channels = useApp((s) => (guildId ? s.channelsByGuild[guildId] : undefined))
  const channel = channels?.find((c) => c.id === selectedChannelId)

  if (!guildId) return null

  const sorted = [...(members ?? [])].sort((a, b) =>
    memberName(a).localeCompare(memberName(b)),
  )

  return (
    <aside className="members">
      <header className="members-header">
        <span>{channel ? channelLabel(channel) : 'Members'}</span>
        <span className="members-count">{sorted.length || '…'}</span>
      </header>
      <div className="members-scroll">
        {sorted.length === 0 && (
          <div className="members-empty">
            {loading === 'online' ? (
              <button className="link-btn" onClick={() => void loadMembers(guildId)}>
                Load member list
              </button>
            ) : (
              'Waiting for the gateway…'
            )}
          </div>
        )}
        {sorted.map((member) => (
          <div key={member.user.id} className="member-row" title={formatTime(member.joined_at)}>
            <img className="dm-avatar" src={avatarUrl(member.user, 32)} alt="" loading="lazy" />
            <span
              className="member-name"
              style={{ color: roleColor(member, roles ?? {}) }}
            >
              {memberName(member)}
            </span>
            {member.user.bot && <span className="bot-tag">BOT</span>}
          </div>
        ))}
      </div>
    </aside>
  )
}
