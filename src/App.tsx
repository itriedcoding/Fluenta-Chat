import { useEffect, useState } from 'react'
import { restoreSession, useApp } from './lib/store'
import Login from './components/Login'
import GuildBar from './components/GuildBar'
import ChannelSidebar from './components/ChannelSidebar'
import Chat from './components/Chat'
import MemberList from './components/MemberList'
import SettingsModal from './components/SettingsModal'
import UpdateBanner from './components/UpdateBanner'
import { platformName } from './lib/transport'

function Splash({ label }: { label: string }) {
  return (
    <div className="splash">
      <div className="splash-logo" aria-hidden />
      <div className="splash-text">{label}</div>
      <div className="splash-bar">
        <span />
      </div>
    </div>
  )
}

export default function App() {
  const status = useApp((s) => s.status)
  const token = useApp((s) => s.token)
  const gateway = useApp((s) => s.gateway)
  const error = useApp((s) => s.error)
  const settings = useApp((s) => s.settings)
  const selectedGuildId = useApp((s) => s.selectedGuildId)
  const selectedChannelId = useApp((s) => s.selectedChannelId)
  const mobilePane = useApp((s) => s.mobilePane)
  const clearError = useApp((s) => s.clearError)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [booted, setBooted] = useState(false)

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', settings.accent)
    document.body.dataset.compact = String(settings.compact)
  }, [settings.accent, settings.compact])

  useEffect(() => {
    if (booted) return
    setBooted(true)
    restoreSession()
  }, [booted])

  useEffect(() => {
    document.title = selectedChannelId ? 'Fluenta' : 'Fluenta'
  }, [selectedChannelId])

  if (!token) {
    return <Login />
  }

  if (status === 'connecting' && !selectedChannelId) {
    return <Splash label="Connecting to Discord…" />
  }

  return (
    <div className="app" data-pane={mobilePane}>
      <GuildBar onOpenSettings={() => setSettingsOpen(true)} />
      <ChannelSidebar onOpenSettings={() => setSettingsOpen(true)} />
      <main className="chat-area">
        <Chat />
      </main>
      {settings.memberList && selectedGuildId && <MemberList />}
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {gateway === 'reconnecting' && (
        <div className="net-banner">Connection lost — reconnecting…</div>
      )}
      <UpdateBanner />
      {error && (
        <div className="toast" role="alert" onClick={clearError}>
          {error}
          <span className="toast-close">✕</span>
        </div>
      )}
      <div className="platform-badge" title="Running platform">
        {platformName()}
      </div>
    </div>
  )
}
