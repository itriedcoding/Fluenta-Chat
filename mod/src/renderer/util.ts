import type { PluginContext, PluginDefinition } from './plugins/registry'

/** Shared helpers injected into the page by the mod. */

export const withTimeout = <T>(promise: Promise<T>, ms: number, label: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

export function injectStyle(id: string, css: string): () => void {
  let element = document.getElementById(id) as HTMLStyleElement | null
  if (!element) {
    element = document.createElement('style')
    element.id = id
    document.head.appendChild(element)
  }
  element.textContent = css
  return () => {
    element?.remove()
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function waitForWebpack(timeoutMs = 20000): Promise<void> {
  return withTimeout(
    new Promise<void>((resolve) => {
      if (Array.isArray((window as any).webpackChunkdiscord_app)) return resolve()
      const timer = setInterval(() => {
        if (Array.isArray((window as any).webpackChunkdiscord_app)) {
          clearInterval(timer)
          resolve()
        }
      }, 50)
    }),
    timeoutMs,
    'Waiting for Discord webpack',
  )
}

export type { PluginContext, PluginDefinition }
