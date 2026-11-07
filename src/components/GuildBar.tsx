import { useApp } from '../lib/store'
import { guildIconUrl, hueFor, initials } from '../lib/ui'

export default function GuildBar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const guilds = useApp((s) => s.guilds)
  const selectedGuildId = useApp((s) => s.selectedGuildId)
  const selectGuild = useApp((s) => s.selectGuild)
  const dmChannels = useApp((s) => s.dmChannels)
  const me = useApp((s) => s.me)
  const gateway = useApp((s) => s.gateway)
  const logout = useApp((s) => s.logout)

  return (
    <nav className="guildbar" aria-label="Servers">
      <button
        className={`guild-pill home-pill${selectedGuildId === null ? ' active' : ''}`}
        onClick={() => void selectGuild(null)}
        title="Direct messages"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
          <path
            fill="currentColor"
            d="M12 3 3 10.2V21h6v-6h6v6h6V10.2L12 3Z"
          />
        </svg>
        {dmChannels.length > 0 && <span className="dm-count">{dmChannels.length}</span>}
      </button>

      <div className="guild-divider" />

      <div className="guild-scroll">
        {guilds.map((guild) => {
          const icon = guildIconUrl(guild)
          const active = guild.id === selectedGuildId
          return (
            <button
              key={guild.id}
              className={`guild-pill${active ? ' active' : ''}`}
              onClick={() => void selectGuild(guild.id)}
              title={guild.name}
            >
              {icon ? (
                <img src={icon} alt="" className="guild-icon" loading="lazy" />
              ) : (
                <span
                  className="guild-fallback"
                  style={{ background: `hsl(${hueFor(guild.id)} 55% 42%)` }}
                >
                  {initials(guild.name || '?')}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="guild-footer">
        <span className={`conn-dot ${gateway}`} title={`Gateway: ${gateway}`} />
        <button className="guild-pill icon-pill" onClick={onOpenSettings} title="Settings">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              fill="currentColor"
              d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 4-1.9-.6a7.4 7.4 0 0 0-.7-1.7l.9-1.8-1.9-1.9-1.8.9a7.4 7.4 0 0 0-1.7-.7L13.3 4h-2.6l-.6 1.9a7.4 7.4 0 0 0-1.7.7L6.6 5.7 4.7 7.6l.9 1.8a7.4 7.4 0 0 0-.7 1.7L3 12l.6 1.9c.2.6.4 1.2.7 1.7l-.9 1.8 1.9 1.9 1.8-.9c.5.3 1.1.5 1.7.7l.6 1.9h2.6l.6-1.9c.6-.2 1.2-.4 1.7-.7l1.8.9 1.9-1.9-.9-1.8c.3-.5.5-1.1.7-1.7L21 12Z"
            />
          </svg>
        </button>
        <button
          className="guild-pill icon-pill avatar-pill"
          onClick={logout}
          title={`Sign out ${me?.username ?? ''}`}
        >
          {me?.avatar ? (
            <img
              src={`https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=64`}
              alt=""
              className="guild-icon"
            />
          ) : (
            <span className="guild-fallback" style={{ background: 'hsl(240 40% 40%)' }}>
              {initials(me?.username ?? '?')}
            </span>
          )}
        </button>
      </div>
    </nav>
  )
}
