/**
 * Discord Gateway (v10, JSON encoding) client: hello/heartbeat, identify,
 * resume, reconnect and dispatch. Everything here is the real protocol — there
 * is no simulated event source.
 */

export type GatewayStatus = 'connecting' | 'online' | 'reconnecting' | 'offline'

const INTENTS =
  1 << 0 | // GUILDS
  1 << 9 | // GUILD_MESSAGES
  1 << 12 | // DIRECT_MESSAGES
  1 << 15 // MESSAGE_CONTENT

interface GatewayOptions {
  token: string
  onEvent: (type: string, data: any) => void
  onStatus: (status: GatewayStatus) => void
  onFatal: (reason: string) => void
}

export class Gateway {
  private ws: WebSocket | null = null
  private seq: number | null = null
  private sessionId: string | null = null
  private resumeUrl: string | null = null
  private heartbeatTimer: number | null = null
  private reconnectTimer: number | null = null
  private heartbeatAcked = true
  private attempts = 0
  private stopped = false

  constructor(private opts: GatewayOptions) {}

  start() {
    this.stopped = false
    this.connect(this.resumeUrl ?? 'wss://gateway.discord.gg')
  }

  stop() {
    this.stopped = true
    this.clearTimers()
    this.sessionId = null
    this.seq = null
    if (this.ws) {
      this.ws.onclose = null
      try {
        this.ws.close(1000, 'client stop')
      } catch {
        /* already gone */
      }
      this.ws = null
    }
  }

  private clearTimers() {
    if (this.heartbeatTimer !== null) window.clearInterval(this.heartbeatTimer)
    if (this.reconnectTimer !== null) window.clearTimeout(this.reconnectTimer)
    this.heartbeatTimer = null
    this.reconnectTimer = null
  }

  private connect(base: string) {
    this.clearTimers()
    this.opts.onStatus(this.attempts === 0 ? 'connecting' : 'reconnecting')

    const url = `${base.replace(/\/$/, '')}/?v=10&encoding=json`
    const ws = new WebSocket(url)
    this.ws = ws

    ws.onmessage = (ev) => {
      let payload: any
      try {
        payload = JSON.parse(typeof ev.data === 'string' ? ev.data : '')
      } catch {
        return
      }
      this.handle(payload)
    }

    ws.onclose = (ev) => {
      if (this.stopped) return
      this.clearTimers()
      this.opts.onStatus('reconnecting')
      // 4004 = authentication failed, 4010/4011/4012/4013/4014 = bad config.
      if (ev.code === 4004) {
        this.opts.onFatal('Discord rejected the token. Check that it is valid and unexpired.')
        return
      }
      if ([4010, 4011, 4012, 4013, 4014].includes(ev.code)) {
        this.opts.onFatal(`Gateway closed the connection (${ev.code}). Try again later.`)
        return
      }
      if (ev.code === 1000 || ev.code === 1001 || ev.code === 4000) {
        // Normal closes still need a fresh identify.
        this.sessionId = null
      }
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      /* onclose always follows and drives reconnection */
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return
    this.attempts += 1
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.attempts, 5))
    this.reconnectTimer = window.setTimeout(() => this.connect(this.resumeUrl ?? 'wss://gateway.discord.gg'), delay)
  }

  private send(payload: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(payload))
  }

  private heartbeat() {
    if (!this.heartbeatAcked) {
      // Zombied connection — drop it and resume.
      try {
        this.ws?.close(4000, 'heartbeat timeout')
      } catch {
        /* ignore */
      }
      return
    }
    this.heartbeatAcked = false
    this.send({ op: 1, d: this.seq })
  }

  private identify() {
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
    this.send({
      op: 2,
      d: {
        token: this.opts.token,
        intents: INTENTS,
        properties: {
          os: nav.userAgentData?.platform ?? navigator.platform ?? 'unknown',
          browser: 'Fluenta',
          device: 'Fluenta',
          system_locale: navigator.language,
          browser_user_agent: navigator.userAgent,
          browser_version: (navigator.userAgent.match(/(?:Chrome|Firefox|Edg|Safari)\/[\d.]+/) ?? [''])[0],
          os_version: '',
          referrer: '',
          referring_domain: '',
          release_channel: 'stable',
          client_build_number: 320000,
          client_event_source: null,
        },
        presence: { status: 'online', since: 0, activities: [], afk: false },
      },
    })
  }

  private handle(payload: { op: number; d: any; s: number | null; t: string | null }) {
    switch (payload.op) {
      case 10: {
        const interval = payload.d.heartbeat_interval as number
        this.send({ op: 1, d: this.seq })
        this.heartbeatAcked = true
        this.heartbeatTimer = window.setInterval(() => this.heartbeat(), interval)
        if (this.sessionId && this.seq !== null) {
          this.send({
            op: 6,
            d: { token: this.opts.token, session_id: this.sessionId, seq: this.seq },
          })
        } else {
          this.identify()
        }
        break
      }
      case 11:
        this.heartbeatAcked = true
        break
      case 7:
        // Server-requested reconnect: keep session for resume.
        try {
          this.ws?.close(4000, 'server reconnect')
        } catch {
          /* ignore */
        }
        break
      case 9:
        // Invalid session.
        if (!payload.d) {
          this.sessionId = null
          this.seq = null
        }
        window.setTimeout(() => {
          if (this.sessionId && this.seq !== null) {
            this.send({ op: 6, d: { token: this.opts.token, session_id: this.sessionId, seq: this.seq } })
          } else {
            this.identify()
          }
        }, 1000 + Math.random() * 4000)
        break
      case 0: {
        if (payload.s !== null) this.seq = payload.s
        const type = payload.t
        if (!type) return
        if (type === 'READY') {
          this.sessionId = payload.d.session_id
          this.resumeUrl = payload.d.resume_gateway_url ?? null
          this.attempts = 0
          this.opts.onStatus('online')
        }
        if (type === 'RESUMED') {
          this.attempts = 0
          this.opts.onStatus('online')
        }
        this.opts.onEvent(type, payload.d)
        break
      }
      default:
        break
    }
  }
}
