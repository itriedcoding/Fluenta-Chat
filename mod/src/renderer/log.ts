export type LogLevel = 'info' | 'warn' | 'error'

export interface LogEntry {
  at: number
  level: LogLevel
  message: string
}

const entries: LogEntry[] = []
const listeners = new Set<(entries: LogEntry[]) => void>()

const push = (level: LogLevel, message: string) => {
  entries.push({ at: Date.now(), level, message })
  if (entries.length > 400) entries.splice(0, entries.length - 400)
  for (const listener of listeners) listener([...entries])
}

export const log = (message: string) => {
  console.log('[Fluenta]', message)
  push('info', message)
}

export const warn = (message: string) => {
  console.warn('[Fluenta]', message)
  push('warn', message)
}

export const error = (message: string, cause?: unknown) => {
  console.error('[Fluenta]', message, cause)
  push('error', cause ? `${message}: ${String(cause)}` : message)
}

export const getLogs = (): LogEntry[] => [...entries]

export const onLog = (listener: (entries: LogEntry[]) => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
