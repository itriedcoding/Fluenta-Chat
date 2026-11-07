import { useState } from 'react'
import { useApp } from '../lib/store'
import { platformName } from '../lib/transport'

export default function Login() {
  const login = useApp((s) => s.login)
  const status = useApp((s) => s.status)
  const error = useApp((s) => s.error)
  const [token, setToken] = useState('')
  const [isBot, setIsBot] = useState(false)
  const [reveal, setReveal] = useState(false)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = isBot && !/^bot\s/i.test(token) ? `Bot ${token.trim()}` : token
    void login(value)
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="brand-mark" aria-hidden>
            F
          </div>
          <div>
            <h1>Fluenta</h1>
            <p>A custom Discord client for Windows &amp; Android</p>
          </div>
        </div>

        <label className="field">
          <span>Account token</span>
          <div className="token-row">
            <input
              type={reveal ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Discord token"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button
              type="button"
              className="ghost-btn"
              onClick={() => setReveal((v) => !v)}
              aria-label={reveal ? 'Hide token' : 'Show token'}
            >
              {reveal ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isBot}
            onChange={(e) => setIsBot(e.target.checked)}
          />
          <span>This is a bot token</span>
        </label>

        {error && <div className="form-error">{error}</div>}

        <button className="primary-btn" type="submit" disabled={status === 'connecting'}>
          {status === 'connecting' ? 'Signing in…' : 'Connect'}
        </button>

        <p className="login-hint">
          The token is stored only on this device and is sent directly to
          discord.com — Fluenta has no backend and never sees your credentials.
        </p>

        <div className="login-foot">
          Running as <strong>{platformName()}</strong> · live Discord REST + Gateway
        </div>
      </form>
    </div>
  )
}
