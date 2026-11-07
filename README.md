# Fluenta

A **Discord client mod for Windows**, in the style of Vencord. It patches the
Discord desktop app you already have installed and signed in — **there is no
token to paste, no bot account, and no second client**.

![Fluenta](public/icon.png)

## Install

Download `Fluenta-Mod-Setup.exe` from
[Releases](https://github.com/itriedcoding/Fluenta-Chat/releases/latest) and run it:

```
  1) Install / repair
  2) Uninstall
  3) Update to the latest release
  4) Status
  5) Quit
```

Pick **1**, fully quit Discord (tray icon → Quit — closing the window is not
enough), then start Discord again. Press **Ctrl+Shift+F** or click the **F**
button in the bottom-left to open the Fluenta panel.

The installer also works headlessly:

```bash
Fluenta-Mod-Setup.exe install      # patch every Discord install found
Fluenta-Mod-Setup.exe uninstall    # restore the original app.asar
Fluenta-Mod-Setup.exe update       # pull the newest mod build
Fluenta-Mod-Setup.exe status
Fluenta-Mod-Setup.exe install --dir "C:\path\to\Discord\resources"
```

## How it works

1. The installer finds your Discord install
   (`%LOCALAPPDATA%\Discord\app-*\resources`, plus PTB / Canary).
2. It extracts `resources/app.asar` into `resources/app/` and renames the original
   to `app.asar.fluenta-backup`, so Electron loads the patched directory.
3. Discord's `app/index.js` gets a loader prepended that requires
   `./fluenta/desktop.js`.
4. That main-process loader runs `renderer.js` inside Discord's window, where the
   patcher resolves Discord's own webpack modules and starts the plugins.
5. Uninstall deletes the patched directory and restores the untouched archive.

Everything runs locally. No proxy, no token, no account takeover surface.

## Plugins

| Plugin | Default | What it does |
| --- | --- | --- |
| Custom theme | on | Injects your own CSS, edited in the Theme tab |
| Hide Nitro upsells | on | Hides gift/shop/Nitro promo surfaces |
| Message logger | off | Keeps deleted and edited messages locally (last 1000), exportable as JSON |
| Keyword highlight | off | Tints messages matching your comma-separated keywords |

Plugins are isolated: one that fails reports the reason in the panel and the rest
keep working. Enabled state and settings live in `localStorage`.

Writing a plugin is one file — see `mod/src/renderer/plugins/hideNitro.ts`:

```ts
export const myPlugin: PluginDefinition = {
  id: 'myPlugin',
  name: 'My plugin',
  description: 'What it does.',
  start(ctx) {
    const off = ctx.subscribe('MESSAGE_CREATE', (payload) => ctx.log(payload.message.id))
    return () => off() // cleanup when disabled
  },
}
```

Add it to `allPlugins` in `mod/src/renderer/plugins/index.ts`.

## Development

```bash
npm install
npm run mod:build        # mod/dist/{desktop.js,renderer.js,cli.cjs}
npm run mod:typecheck
npm run mod:test         # injector + patcher tests
npm run mod:install      # build and patch your local Discord
npm run mod:exe          # build release/Fluenta-Mod-Setup.exe (Node SEA)
```

`mod:exe` uses Node's single-executable-application support: it bakes
`mod/dist/cli.cjs` into a blob and injects it into `node.exe`, so the result is a
real Windows executable with no Node runtime needed. `--linux` builds a local
binary and runs it as a self-test.

## Releases

Every push to `main` runs `.github/workflows/release.yml`, which builds on
Windows and publishes a release tagged `v<version>`:

| Asset | What it is |
| --- | --- |
| `Fluenta-Mod-Setup.exe` | Interactive Windows installer (single executable) |
| `desktop.js`, `renderer.js`, `cli.cjs` | The mod bundles, for manual/CLI installs |

The mod reads that release feed itself: **Check for mod updates** in the panel,
or `Fluenta-Mod-Setup.exe update`. Both compare against
`api.github.com/repos/itriedcoding/Fluenta-Chat/releases/latest` — live data, no
bundled version list.

## Repo layout

```
mod/
  src/injector/      app.asar detection, patching, restore, release downloads
  src/shared/        install path discovery, version
  src/main/          Electron main-process loader
  src/renderer/      webpack patcher, plugin registry, panel UI, plugins
  tests/             injector + patcher tests
tools/build-sea.mjs  packages the installer as a Windows .exe
src/                 older standalone client kept for reference (not shipped)
```

## Notes and limits

- Modding Discord violates its Terms of Service; accounts have been actioned for
  client mods. Same risk Vencord/BetterDiscord users take.
- Discord updates replace `app.asar` and revert the patch. Re-run the installer
  (or `status`, which reports `needs-repair`).
- Plugin internals depend on Discord's private webpack modules; each plugin fails
  gracefully and reports in the panel.
- **Android is not supported.** Patching Discord's Android build requires
  re-signing its APK, which a mod cannot do — so no APK is published.
- The installer is unsigned, so Windows SmartScreen will warn until it is signed.
- Voice, uploads and search are not implemented.
