import { error, log as writeLog, warn } from '../log'
import {
  findByProps,
  findBySource,
  subscribe as fluxSubscribe,
} from '../patcher'

export interface PluginContext {
  log: (message: string) => void
  warn: (message: string) => void
  getSetting: <T>(key: string, fallback: T) => T
  setSetting: <T>(key: string, value: T) => void
  subscribe: (event: string, handler: (payload: any) => void) => () => void
  findByProps: <T = Record<string, any>>(...props: string[]) => T | null
  findBySource: (pattern: RegExp) => Record<string, any>[]
}

export interface PluginDefinition {
  id: string
  name: string
  description: string
  defaultEnabled?: boolean
  start: (ctx: PluginContext) => void | (() => void)
}

export interface PluginRuntime {
  enabled: boolean
  error?: string
}

const ENABLED_KEY = 'fluenta.plugins.enabled'

const loadEnabled = (): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(ENABLED_KEY) ?? '{}') as Record<string, boolean>
  } catch {
    return {}
  }
}

const saveEnabled = (map: Record<string, boolean>) => {
  try {
    localStorage.setItem(ENABLED_KEY, JSON.stringify(map))
  } catch {
    /* storage full or disabled */
  }
}

const enabledMap = loadEnabled()
export const runtime: Record<string, PluginRuntime> = {}
const cleanups = new Map<string, (() => void) | undefined>()

export const isPluginEnabled = (plugin: PluginDefinition): boolean =>
  enabledMap[plugin.id] ?? plugin.defaultEnabled ?? false

export const getPluginSetting = <T,>(pluginId: string, key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(`fluenta.plugins.${pluginId}.${key}`)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export const setPluginSetting = (pluginId: string, key: string, value: unknown) => {
  try {
    localStorage.setItem(`fluenta.plugins.${pluginId}.${key}`, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function contextFor(plugin: PluginDefinition): PluginContext {
  return {
    log: (message) => writeLog(`${plugin.name}: ${message}`),
    warn: (message) => warn(`${plugin.name}: ${message}`),
    getSetting: (key, fallback) => getPluginSetting(plugin.id, key, fallback),
    setSetting: (key, value) => setPluginSetting(plugin.id, key, value),
    subscribe: fluxSubscribe,
    findByProps,
    findBySource,
  }
}

export function stopPlugin(plugin: PluginDefinition) {
  const cleanup = cleanups.get(plugin.id)
  cleanup?.()
  cleanups.delete(plugin.id)
  runtime[plugin.id] = { enabled: false }
}

export function startPlugin(plugin: PluginDefinition) {
  if (!isPluginEnabled(plugin)) {
    runtime[plugin.id] = { enabled: false }
    return
  }
  try {
    const cleanup = plugin.start(contextFor(plugin))
    cleanups.set(plugin.id, typeof cleanup === 'function' ? cleanup : undefined)
    runtime[plugin.id] = { enabled: true }
    writeLog(`${plugin.name} enabled`)
  } catch (cause) {
    runtime[plugin.id] = {
      enabled: false,
      error: cause instanceof Error ? cause.message : String(cause),
    }
    error(`${plugin.name} failed to start`, cause)
  }
}

export function setPluginEnabled(plugin: PluginDefinition, enabled: boolean) {
  enabledMap[plugin.id] = enabled
  saveEnabled(enabledMap)
  stopPlugin(plugin)
  if (enabled) startPlugin(plugin)
  else runtime[plugin.id] = { enabled: false }
}

export function startAll(plugins: PluginDefinition[]) {
  for (const plugin of plugins) startPlugin(plugin)
}
