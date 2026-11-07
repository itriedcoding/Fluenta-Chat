import { useApp } from '../lib/store'
import { avatarUrl, channelLabel, displayName, guildIconUrl, initials } from '../lib/ui'
import { CHANNEL } from '../lib/types'

export default function ChannelSidebar({
  onOpenSettings,
}: {
  onOpenSettings: () => void
}) {
  const selectedGuildId = useApp((s) => s.selectedGuildId)
  const guilds = useApp((s) => s.guilds)
  const channelsByGuild = useApp((s) => s.channelsByGuild)
  const dmChannels = useApp((s) => s.dmChannels)
  const channelIndex = useApp((s) => s.channelIndex)
  const selectedChannelId = useApp((s) => s.selectedChannelId)
  const selectChannel = useApp((s) => s.selectChannel)
  const unread = useApp((s) => s.unread)
  const me = useApp((s) => s.me)

  const guild = guilds.find((g) => g.id === selectedGuildId) ?? null
  const channels = guild ? (channelsByGuild[guild.id] ?? []) : []
  const dmList = dmChannels
    .map((c) => (channelIndex[c.id] ? { ...channelIndex[c.id], ...c } : c))
    .filter((c) => c.type === CHANNEL.DM || c.type === CHANNEL.GROUP_DM)

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        {guild ? (
          <>
            {guildIconUrl(guild, 48) ? (
              <img className="sidebar-guild-icon" src={guildIconUrl(guild, 48)!} alt="" />
            ) : (
              <span className="sidebar-guild-fallback">{initials(guild.name)}</span>
            )}
            <span className="sidebar-title">{guild.name}</span>
          </>
        ) : (
          <span className="sidebar-title">Direct messages</span>
        )}
      </header>

      <div className="sidebar-scroll">
        {guild ? (
          channels.length === 0 ? (
            <p className="sidebar-empty">No text channels available.</p>
          ) : (
            <>
              <div className="sidebar-section">Text channels</div>
              {channels.map((channel) => {
                const count = unread[channel.id] ?? 0
                return (
                  <button
                    key={channel.id}
                    className={`channel-row${channel.id === selectedChannelId ? ' active' : ''}`}
                    onClick={() => void selectChannel(channel.id)}
                  >
                    <span className="channel-hash">{channel.type === CHANNEL.FORUM ? '▤' : '#'}</span>
                    <span className="channel-name">{channelLabel(channel)}</span>
                    {count > 0 && <span className="unread-badge">{count > 99 ? '99+' : count}</span>}
                  </button>
                )
              })}
            </>
          )
        ) : dmList.length === 0 ? (
          <p className="sidebar-empty">No direct messages yet.</p>
        ) : (
          <>
            <div className="sidebar-section">Direct messages</div>
            {dmList.map((channel) => {
              const other = channel.recipients?.find((r) => r.id !== me?.id) ?? channel.recipients?.[0]
              const count = unread[channel.id] ?? 0
              return (
                <button
                  key={channel.id}
                  className={`channel-row dm-row${channel.id === selectedChannelId ? ' active' : ''}`}
                  onClick={() => void selectChannel(channel.id)}
                >
                  {other ? (
                    <img className="dm-avatar" src={avatarUrl(other, 32)} alt="" loading="lazy" />
                  ) : (
                    <span className="dm-avatar fallback">#</span>
                  )}
                  <span className="channel-name">
                    {other ? displayName(other) : channelLabel(channel)}
                  </span>
                  {count > 0 && <span className="unread-badge">{count > 99 ? '99+' : count}</span>}
                </button>
              )
            })}
          </>
        )}
      </div>

      <footer className="sidebar-footer">
        <button className="side-action" onClick={onOpenSettings}>
          <span className="side-action-icon">⚙</span> Settings
        </button>
        <div className="me-row">
          {me && <img className="dm-avatar" src={avatarUrl(me, 32)} alt="" />}
          <div className="me-meta">
            <span className="me-name">{me ? displayName(me) : '—'}</span>
            <span className="me-tag">#{me?.discriminator ?? '0000'}</span>
          </div>
        </div>
      </footer>
    </aside>
  )
}
