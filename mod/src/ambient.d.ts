/**
 * Minimal ambient types for the parts of Electron the loader touches.
 * `electron` is provided by Discord at runtime and bundled as an external,
 * so installing the full electron package just for types is unnecessary.
 */
declare module 'electron' {
  export interface Input {
    key: string
    control: boolean
    meta: boolean
    shift: boolean
  }

  export interface WebContents {
    getType(): string
    executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>
    on(event: 'did-finish-load', listener: () => void): void
    on(
      event: 'before-input-event',
      listener: (event: unknown, input: Input) => void,
    ): void
    openDevTools(options?: { mode?: 'left' | 'right' | 'bottom' | 'undocked' | 'detach' }): void
  }

  export interface App {
    on(
      event: 'web-contents-created',
      listener: (event: unknown, contents: WebContents) => void,
    ): void
  }

  export const app: App
}
