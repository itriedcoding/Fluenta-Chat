# Fluenta

A custom Discord client for **Windows** and **Android**.

Fluenta is a real client: it authenticates against Discord, loads your servers and
direct messages, receives live events over the Discord Gateway, and sends,
edits, reacts to and deletes real messages. There are no mocks, fixtures or fake
data anywhere in the app — every screen is driven by live Discord API responses.

![Fluenta](public/icon.png)

## What it does

| Area | Support |
| --- | --- |
| Auth | User tokens and bot tokens, validated with `GET /users/@me` |
| Gateway v10 | Identify, heartbeat, resume, reconnect with exponential backoff |
| Servers | Guild list, guild icons, text/announcement/forum channels |
| DMs | Direct and group DM channels |
| Messages | 50-message history pages with infinite scroll, send, edit, delete, reply |
| Live events | `MESSAGE_CREATE/UPDATE/DELETE`, `TYPING_START`, reactions, channel + guild updates |
| Rendering | Markdown (bold/italic/strike/underline), code blocks, spoilers, mentions, custom emoji, `<t:…>` timestamps, links |
| Attachments | Images, video, audio and file cards, plus basic embed rendering |
| Reactions | Live counts, click to add/remove, quick emoji picker |
| Members | Guild member list with role colours |
| Platform | Windows (Tauri v2), Android (Capacitor 7), and a plain web build |

## Architecture

```
src/
  lib/
    api.ts        typed REST client (rate-limit aware, 429 retry)
    gateway.ts    Discord Gateway v10 websocket client
    transport.ts  browser fetch / Tauri HTTP / Capacitor HTTP
    store.ts      zustand state, gateway event reducer
    markdown.tsx  Discord-flavoured markdown → React nodes (no innerHTML)
    types.ts      Discord object types used by the client
  components/     Login, GuildBar, ChannelSidebar, Chat, MessageRow, Composer, MemberList, Settings
src-tauri/        Windows desktop shell (Rust + Tauri 2)
android/          Android shell (Capacitor 7, generated with `cap add android`)
tools/gen-icons.mjs  generates the PNG/ICO icon set (no dependencies)
```

There is **no backend**. The client talks straight to `https://discord.com/api/v10`
and `wss://gateway.discord.gg`. The token is stored in `localStorage` on the
device and sent only to Discord.

Native shells use their platform HTTP stacks (`tauri-plugin-http`,
`CapacitorHttp`) so requests are not subject to WebView CORS rules.

## Run it

Requires Node 20+.

```bash
npm install
npm run dev            # web build at http://localhost:3000
```

Sign in with your Discord token, or tick “This is a bot token” and paste a bot
token.

> Where to get a token: a user token lives in the Discord client's local storage
> (`localStorage.getItem('token')` in the web app's devtools) — and using it with
> third-party clients is against Discord's Terms of Service. Bot tokens are
> created in the [Discord Developer Portal](https://discord.com/developers/applications)
> and the same app works with them; bots additionally need the
> **Message Content** privileged intent to read message text.

## Build for Windows

Prerequisites: Rust toolchain (`rustup`), Visual Studio C++ build tools, WebView2
(shipped with Windows 11).

```bash
npm install
npm run icons          # generate icon set (already committed, safe to re-run)
npm run windows:build  # produces MSI + NSIS installers in src-tauri/target/release/bundle
npm run windows:dev    # hot-reload desktop window
```

## Build for Android

Prerequisites: Android Studio (SDK 35 + build tools), JDK 17+.

```bash
npm install
npm run android:build  # vite build + `cap sync android`
npm run android:open   # opens the project in Android Studio
```

Then run ▶ from Android Studio, or `cd android && ./gradlew assembleDebug` to get
`android/app/build/outputs/apk/debug/app-debug.apk`.

## Configuration

| Variable | Purpose |
| --- | --- |
| `VITE_ALLOWED_HOST` | Optional extra hostname allowed by the Vite dev server (used for cloud previews) |

## Notes and limits

- Fluenta is an unofficial client. Discord's Terms of Service do not permit
  third-party clients and automated user accounts can be terminated. Use it with
  that risk understood, and prefer a bot token for anything long-lived.
- Voice channels, threads, file uploads and message search are not implemented.
  Voice channels are intentionally hidden rather than shown as dead UI.
- Channel lists are not permission-filtered: the client shows every text channel
  the token can see, because computed per-channel permissions are not part of the
  channel object returned by REST.
- Rate limits are handled per request (429 + `retry_after`); Fluenta does not do
  full bucket pre-emption.
