# Intent

A Chrome extension that captures **why** something mattered, not just what you saved.

Highlight text on any page → press a shortcut → an LLM classifies it, writes a reason, suggests tags, and stores it locally. A companion Electron desktop app reads captures in real-time from a local SQLite database — no cloud account, no hosting, no data leaving your machine.

---

## How it works

```
Browser tab
  │  Ctrl+Shift+S (selection or active page)
  ▼
Extension service worker
  │  LLM classify (Anthropic / Gemini / LM Studio)
  │  → chrome.storage.local   (offline-first)
  │  → POST localhost:47832/captures  (fire-and-forget)
  ▼
Electron main process
  │  SQLite INSERT … ON CONFLICT DO UPDATE  (idempotent)
  │  → IPC push "captures-updated"
  ▼
Dashboard renderer
  └  Re-fetches SQLite → updates grid instantly
```

The HTTP server on `localhost:47832` is the only bridge between the browser extension and the desktop app. The extension pushes every capture and replays all of `chrome.storage.local` on each service worker startup as a catch-up mechanism. Supabase is an optional secondary sync layer — the system is fully functional without it.

---

## Features

**Extension**
- Shortcut capture — select text, press `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac)
- Quick capture — type directly in the popup
- LLM classification — auto-assigns intent (8 categories), title, reason, extract, and 3–5 tags
- Inline tag editor — add or remove tags after saving
- Filter tabs and tag cloud — browse by intent or tag
- Search — full-text across titles, reasons, and raw text
- Edit captures — update title, reason, intent, or tags; re-classify with one click
- Export — JSON or Markdown

**Desktop dashboard**
- Real-time sync — new captures appear within seconds via IPC push, no polling
- Distillation — LLM extracts 3 key insights on demand; result cached per capture
- Delete — soft-delete from detail view, reflected immediately in the grid
- Edit and re-classify — same as extension, changes synced back to SQLite
- Links open in the system default browser
- Export all or individual captures as Markdown

---

## Quick start

### 1. Load the Chrome extension

```
chrome://extensions  →  Developer mode ON  →  Load unpacked  →  select repo root
```

Pin the ◆ icon. Open **Settings (⚙)** and choose a provider (see [Configuration](#configuration)).

### 2. Run the desktop app

```bash
cd web
npm install
npm run electron      # builds Vite output then opens in Electron
```

The app starts the HTTP server on `localhost:47832`. Captures you made before opening the app will be replayed automatically when the extension service worker next starts (e.g. on the next capture).

### 3. Capture something

Select text on any page and press `Ctrl+Shift+S`. A toast shows the classification status. Open the desktop app — the capture appears in real-time.

---

## Configuration

Open **Settings (⚙)** in the popup. All values are stored locally — never sent anywhere except your chosen provider's API.

### LLM provider

| Provider | What you need | Notes |
|----------|--------------|-------|
| **Anthropic** | API key (`sk-ant-…`) | [console.anthropic.com](https://console.anthropic.com) |
| **Gemini Cloud** | API key (`AIza…`) | [aistudio.google.com](https://aistudio.google.com) — free tier available |
| **LM Studio** | Running LM Studio instance | Set base URL (default `http://localhost:1234/v1`). Enable CORS in LM Studio. |

### Optional: Supabase sync

Add your Supabase project URL and anon key under **Sync** in Settings. Captures will be pushed to Supabase in addition to the local database. The desktop app will also use Supabase as a read source when running outside Electron.

---

## Architecture

### Data flow

| Event | Extension | Electron |
|-------|-----------|----------|
| New capture | `chrome.storage.local` + `POST /captures` | Upsert SQLite; push `captures-updated` IPC |
| Edit / tag change | Update local + `POST /captures` (full upsert) | Same upsert path |
| Delete | — | `SET deleted_at = now()`; remove from grid |
| SW restart | `replayCapturesToLocal()` — full replay | `COALESCE(existing.deleted_at, incoming.deleted_at)` preserves soft-deletes |
| Dashboard open (Electron) | — | `ipcRenderer.invoke('get-captures')` → SQLite |
| Dashboard open (browser) | — | `fetch('localhost:47832/captures')` → same SQLite via HTTP |

### Why a local HTTP server?

Chrome extensions cannot use native messaging without a host manifest installed on the OS. A lightweight `http.createServer` on `127.0.0.1:47832` is the simplest zero-install bridge:

- Extension pushes via `fetch` with `.catch(() => {})` — never blocks a capture
- Electron reads via IPC (inside the app) or HTTP (browser dev mode)
- Socket-level IP check (`127.0.0.1` / `::1`) rejects any non-loopback request before any parsing

### Idempotent replay

The MV3 service worker is ephemeral — terminated after ~30 s of inactivity and restarted on demand. `replayCapturesToLocal()` runs at every module load and pushes the full `chrome.storage.local` array to SQLite. The upsert query uses:

```sql
ON CONFLICT(id) DO UPDATE SET
  intent = excluded.intent, title = excluded.title, …,
  deleted_at = COALESCE(captures.deleted_at, excluded.deleted_at)
```

`COALESCE` ensures a soft-delete set from the dashboard survives a replay (the extension never sets `deleted_at`, so `excluded.deleted_at` is always `null` — the existing value wins).

### SQLite via `node:sqlite`

Uses Node 22's built-in `node:sqlite` (`DatabaseSync`) — no native add-on, no `node-gyp`, no version pinning. Schema is created on first launch; adding new columns uses `try { ALTER TABLE … ADD COLUMN }` so existing databases migrate silently.

---

## Project structure

```
intent/                         Chrome extension
├── manifest.json
├── popup.html
├── settings.html
└── src/
    ├── background.js           Service worker — routing, storage, local + Supabase sync
    ├── content.js              Toast notifications, cached selection
    ├── llm.js                  LLM adapter (Anthropic / Gemini / LM Studio)
    ├── popup.js                Popup UI — feed, filter, tags, search, export
    └── settings.js             Settings UI — provider config, sync keys

web/                            Electron desktop dashboard
├── electron.cjs                Main process — SQLite, HTTP server on :47832, IPC handlers
├── preload.cjs                 contextBridge — safe IPC surface for renderer
├── vite.config.js              base: './' for file:// loading in Electron
└── src/
    ├── main.js                 App bootstrap, real-time listener, delete/edit handlers
    ├── supabase.js             Data source waterfall: electronBridge → :47832 → Supabase
    ├── llm.js                  LLM adapter + settings persistence (localStorage)
    ├── render.js               Card, detail view, settings panel, install overlay
    ├── export.js               JSON / Markdown / ZIP export
    └── style.css
```

---

## Development

No build step for the extension — edit files, then reload.

```bash
# Reload after changes
# chrome://extensions → ↻ on the Intent card

# Debug service worker
# chrome://extensions → "Inspect views: service worker"
```

Desktop app:

```bash
cd web
npm run dev        # Vite dev server at localhost:5173 — uses HTTP fallback to local server
npm run electron   # full build + launch
npm run dist       # package installer → web/release/
```

---

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Persist captures and settings locally |
| `activeTab` | Read URL and title of the current tab on capture |
| `scripting` | Inject selection-reading script on keyboard shortcut |
| `tabs` | Resolve the active tab for the shortcut handler |

`host_permissions` covers `<all_urls>` (required by `scripting`), the chosen LLM API domain, and `localhost:47832`. No browsing data is collected or transmitted.
