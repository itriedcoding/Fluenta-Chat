import { useApp } from '../lib/store'
import { platformName } from '../lib/transport'

const ACCENTS = ['#7c5cff', '#2dd4bf', '#f472b6', '#f59e0b', '#38bdf8', '#a3e635']

export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const settings = useApp((s) => s.settings)
  const updateSettings = useApp((s) => s.updateSettings)
  const logout = useApp((s) => s.logout)
  const me = useApp((s) => s.me)
  const gateway = useApp((s) => s.gateway)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <header className="modal-header">
          <h2>Settings</h2>
          <button className="ghost-btn" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </header>

        <section className="modal-section">
          <h3>Appearance</h3>
          <div className="accent-row">
            <span>Accent</span>
            <div className="swatches">
              {ACCENTS.map((accent) => (
                <button
                  key={accent}
                  className={`swatch${settings.accent === accent ? ' active' : ''}`}
                  style={{ background: accent }}
                  onClick={() => updateSettings({ accent })}
                  aria-label={`Accent ${accent}`}
                />
              ))}
            </div>
          </div>
          <label className="toggle-row">
            <span>Compact messages</span>
            <input
              type="checkbox"
              checked={settings.compact}
              onChange={(e) => updateSettings({ compact: e.target.checked })}
            />
          </label>
          <label className="toggle-row">
            <span>Show member list</span>
            <input
              type="checkbox"
              checked={settings.memberList}
              onChange={(e) => updateSettings({ memberList: e.target.checked })}
            />
          </label>
        </section>

        <section className="modal-section">
          <h3>Connection</h3>
          <div className="kv">
            <span>Gateway</span>
            <strong className={`conn-text ${gateway}`}>{gateway}</strong>
          </div>
          <div className="kv">
            <span>Platform</span>
            <strong>{platformName()}</strong>
          </div>
          <div className="kv">
            <span>Account</span>
            <strong>{me ? `${me.username} (${me.id})` : '—'}</strong>
          </div>
        </section>

        <section className="modal-section">
          <h3>Session</h3>
          <button
            className="danger-btn"
            onClick={() => {
              logout()
              onClose()
            }}
          >
            Sign out &amp; forget token
          </button>
          <p className="modal-note">
            Fluenta talks directly to Discord's API from this device. There is no
            server in between — your token and messages never leave the app except
            to reach discord.com.
          </p>
        </section>
      </div>
    </div>
  )
}
