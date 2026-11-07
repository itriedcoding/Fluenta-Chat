# Fluenta

A **Discord client mod** in the style of Vencord — it patches the official Discord
desktop app you already have installed, so there is no token to paste, no bot
account, and no second client to keep logged in.

Fluenta is two things in one repo:

| Part | What it is | Platforms |
| --- | --- | --- |
| **`mod/`** | The client mod: injector + renderer patcher + plugin system that runs inside Discord | Windows (Stable / PTB / Canary) |
| **`src/`** | A standalone client used for mobile and web, talking to Discord's REST + Gateway | Android (Capacitor), Web |

The mod needs **no credentials at all** — it runs inside your normal, already
signed-in Discord.

---

## The mod

### How it works

1. `mod/dist/cli.cjs install` finds your Discord installation
   (`%LOCALAPPDATA%\Discord\app-*\resources` on Windows).
2. It extracts `resources/app.asar` into `resources/app/` and renames the original
   archive to `app.asar.fluenta-backup` so Electron loads the patched directory.
3. Discord's `app/index.js` gets a loader prepended that requires
   `./fluenta/desktop.js`.
4. That main-process loader runs `renderer.js` inside Discord's window once the
   page loads. The renderer resolves Discord's own webpack modules and starts the
   plugins.
5. Everything is reversible: `uninstall` deletes the patched directory and puts
   the untouched `app.asar` back.

No network interception, no separate account, no data leaves your machine.

### Install

Download the latest release, or build it yourself:

```bash
npm install
npm run mod:install     # build + patch every Discord install it finds
```

Then fully quit Discord (tray icon → Quit — closing the window is not enough)
and start it again. Press **Ctrl+Shift+F** or click the **F** button in the
bottom-left corner to open the Fluenta panel.

```bash
npm run mod:status      # show detected installs and patch state
npm run mod:uninstall   # restore Discord exactly as it was
```

If Discord is installed elsewhere (or you want to target a specific branch):

```bash
node mod/dist/cli.cjs install --dir "C:\path\to\Discord\resources"
```

### Plugins

| Plugin | Default | What it does |
| --- | --- | --- |
| Custom theme | on | Injects your own CSS, editable in the Theme tab |
| Hide Nitro upsells | on | Hides gift/shop/Nitro promo surfaces |
| Message logger | off | Keeps deleted and edited messages locally (last 1000), exportable as JSON |
| Keyword highlight | off | Tints messages matching your comma-separated keywords |

Plugins are isolated: a plugin that fails to start is reported in the panel and
the rest keep working. Enabled state and settings live in `localStorage`.

Adding a plugin is a single file — see `mod/src/renderer/plugins/hideNitro.ts`
for the smallest example:

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

Then add it to `allPlugins` in `mod/src/renderer/plugins/index.ts`.

### Mod development

```bash
npm run mod:build       # mod/dist/{desktop.js,renderer.js,cli.cjs}
npm run mod:typecheck   # tsc over mod/
npm run mod:test        # unit tests
npm run mod:install     # rebuild + patch
node mod/dist/cli.cjs update   # pull the newest mod build from Releases
```

`mod:test` covers the injector end-to-end against a real `app.asar` built with
`@electron/asar` (install → patched `index.js` → backup → uninstall restores the
original bytes) and the webpack patcher (module discovery by export shape,
throwing modules, Flux subscribe/unsubscribe).

---

## Releases and auto-update

Every push to `main` runs [`.github/workflows/release.yml`](.github/workflows/release.yml), which builds
and publishes a GitHub Release tagged `v<version>` containing:

| Asset | Built from |
| --- | --- |
| `Fluenta_<version>_x64-setup.exe` | Tauri 2 Windows installer (NSIS) |
| `Fluenta_<version>_x64_en-US.msi` | Tauri 2 MSI package |
| `Fluenta-<version>-android.apk` | Capacitor 7 Gradle build |
| `desktop.js`, `renderer.js`, `cli.cjs` | The mod bundles |

Both apps read that release feed over the public GitHub API — no mock data, no
bundled version list:

- **Mobile / web client** — `src/lib/updater.ts` asks
  `api.github.com/repos/itriedcoding/Fluenta-Chat/releases/latest`, compares it
  with the running version, and shows a dismissible banner (plus **Settings →
  Updates → Check for updates**) with the `.exe` or `.apk` asset for the current
  platform.
- **Mod** — the panel's *Check for mod updates* opens the newest release, and
  `node mod/dist/cli.cjs update` downloads the latest `desktop.js` / `renderer.js`
  and re-patches Discord in place.

Updates are notify-and-install rather than silent self-modification: on Windows
you run the new installer, on Android you tap the APK and confirm. That keeps the
update path honest about what it is doing.

---

## The mobile/web client

Android can't be modded the way the desktop app can without re-signing Discord's
APK, so Fluenta ships its own client for mobile — a real one built on the live
Discord API (no mocks):

```bash
npm run dev             # web at http://localhost:3000
npm run build           # production bundle
npm run android:build   # vite build + capacitor sync
npm run android:open    # open the Android project in Android Studio
```

Prerequisites for Android: Android Studio (SDK 35, JDK 17+). Then build
`android/app/build/outputs/apk/debug/app-debug.apk` from Android Studio or
`cd android && ./gradlew assembleDebug`.

Sign in with a Discord token (bot tokens work too). This part *does* use
credentials — it is a client, not a mod.

---

## Repo layout

```
mod/
  src/injector/      app.asar detection, patching, restore
  src/shared/        install path discovery (Windows/macOS/Linux)
  src/main/          Electron main-process loader
  src/renderer/      webpack patcher, plugin registry, panel UI, plugins
  tests/             injector + patcher tests
src/                 standalone client (React + zustand)
src-tauri/           Windows desktop shell for the standalone client
android/             Capacitor Android project
tools/gen-icons.mjs  dependency-free PNG/ICO icon generator
```

## Notes and limits

- Modding Discord violates its Terms of Service; accounts have been actioned for
  client mods. That risk is yours, and it is the same risk Vencord/BetterDiscord
  users take.
- Discord updates replace `resources/app.asar` and revert the patch — re-run
  `npm run mod:install` after an update (or if `mod:status` says `needs-repair`).
- Plugin internals depend on Discord's private webpack modules. Those change
  between updates; each plugin is written defensively and reports failures in the
  panel instead of breaking the client.
- The mod is verified by unit/integration tests and compiles cleanly, but it was
  not launched against a live Discord install from this Linux build environment —
  see `npm run mod:status` and the panel log after installing to confirm on your
  machine.
- The Windows installer and APK are produced by GitHub Actions on real Windows and
  Android toolchains. If Actions is disabled on the fork/repository, enable it
  under **Settings → Actions** or the release job will not run.
- Voice, file uploads and search are not implemented in either part.
