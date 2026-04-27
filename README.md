# Intent

A Chrome extension + Electron desktop app that captures **why** something mattered — not just what you saved.

---

## The problem I kept running into

I read a lot. Articles, papers, book excerpts, product pages. I saved all of it — bookmarks, Pocket, Notion clipper, open tabs. Six months later I had hundreds of saved items and no idea why I cared about any of them. The URL and title were there. The context was gone.

The failure isn't storage — it's timing. The *why* is effortless to capture in the 5–10 seconds right after you save something. Miss that window and it's gone. Every tool I found optimised for accumulation. None of them solved the timing problem.

So I built Intent: select text, press a shortcut, an LLM infers the why and structures it immediately.

---

## How it works

```
Browser tab
  │  Ctrl+Shift+S (selection or active page)
  ▼
Extension service worker
  │  LLM classify (Gemini Nano / Gemini Cloud / Anthropic / LM Studio)
  │  → chrome.storage.local   (offline-first, never blocks)
  │  → POST localhost:47832/captures  (fire-and-forget)
  ▼
Electron main process
  │  SQLite INSERT … ON CONFLICT(id) DO UPDATE  (idempotent)
  │  → IPC push "captures-updated"
  ▼
Dashboard renderer
  └  Re-fetches SQLite → updates grid instantly
```

The HTTP server on `localhost:47832` is the only bridge between browser and desktop. The extension replays all of `chrome.storage.local` on every service worker restart as a catch-up mechanism. Supabase is an optional secondary sync layer — the system is fully functional without it.

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

The app starts the HTTP server on `localhost:47832`. Captures made before opening the app are replayed automatically on the next service worker start.

### 3. Capture something

Select text on any page and press `Ctrl+Shift+S`. A toast shows "Understanding intent…" while the LLM runs. Open the desktop app — the capture appears in real-time.

---

## Configuration

Open **Settings (⚙)** in the popup.

### LLM provider

| Provider | What you need | Notes |
|----------|--------------|-------|
| **Gemini Nano** *(default)* | Nothing | Chrome's built-in AI — on-device, no key, no network call |
| **Gemini Cloud** | API key (`AIza…`) | [aistudio.google.com](https://aistudio.google.com) — free tier available |
| **Anthropic** | API key (`sk-ant-…`) | [console.anthropic.com](https://console.anthropic.com) — uses Haiku |
| **LM Studio** | Running LM Studio instance | Set base URL (default `http://localhost:1234/v1`). Enable CORS. |

### Optional: Supabase sync

Add your Supabase URL and anon key under **Sync** in Settings. Captures push to Supabase in addition to SQLite. Not required — the system works completely without it.

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

Chrome extensions cannot use native messaging without a host manifest installed on the OS — user setup friction. A `http.createServer` on `127.0.0.1:47832` is the simplest zero-install bridge. The extension pushes via `fetch` with `.catch(() => {})` — a capture is never blocked by a network call. Socket-level IP check (`127.0.0.1` / `::1`) rejects any non-loopback request before any parsing.

### Idempotent replay

The MV3 service worker is ephemeral — terminated after ~30 s and restarted on demand. `replayCapturesToLocal()` runs at every module load. The upsert query:

```sql
ON CONFLICT(id) DO UPDATE SET
  intent = excluded.intent, title = excluded.title, …,
  deleted_at = COALESCE(captures.deleted_at, excluded.deleted_at)
```

`COALESCE` ensures a dashboard-side deletion survives a replay. The extension always sends `deleted_at: null`, so the existing value wins whenever it is non-null.

### SQLite via `node:sqlite`

Node 22's built-in `DatabaseSync` — no native add-on, no `node-gyp`, no version pinning. Schema is created on first launch; new columns use `try { ALTER TABLE … ADD COLUMN }` for silent migration.

---

## Design decisions and trade-offs

| Decision | Why | The cost |
|----------|-----|----------|
| Local HTTP server over native messaging | Zero install; works on all OS without a host manifest | Port conflict is possible — mitigated by binding to `127.0.0.1` only |
| `node:sqlite` over `better-sqlite3` | No native add-on, no build step, no platform binaries in installer | Synchronous API only — fine for single-user local use |
| Soft-delete over hard delete | Replays are idempotent; deletions survive service worker restarts | Deleted rows accumulate; queries need `WHERE deleted_at IS NULL` |
| Full replay on every SW start | Captures are never lost even if Electron is closed | O(n) upserts on every restart — acceptable at personal-scale volumes |
| Gemini Nano as default | Zero friction; no key, no external call, fully on-device | Device must support Chrome's built-in AI; graceful fallback to cloud if not |
| Vanilla JS over React | No runtime dependency; fast to load from `file://` | No component model; DOM manipulation is manual |

---

## What's not working well / honest limitations

- **Full replay is O(n)** — if a user has thousands of captures, the service worker restart sends thousands of HTTP requests. It works at personal scale, but doesn't scale well. The right fix is a high-water-mark or last-synced timestamp so only new captures are replayed.
- **Extension and dashboard have separate LLM settings** — the extension stores provider config in `chrome.storage.sync`; the dashboard stores it in `localStorage`. Changing one doesn't update the other (except Supabase keys, which do sync). This creates friction when switching providers.
- **Delete from the extension popup is not wired to the dashboard** — deleting a capture in the extension removes it from `chrome.storage.local` but does not send a soft-delete to the HTTP server. If you delete in the extension and then replay, the capture reappears in the dashboard.
- **No conflict resolution for edits** — if you edit a capture in the extension and in the dashboard at the same time (unlikely but possible), the last write wins. There is no merge strategy.
- **Gemini Nano availability is unpredictable** — the built-in AI API availability varies by Chrome version, device, and whether the model has been downloaded. The fallback chain handles it, but the error messages could be clearer.

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
    ├── llm.js                  LLM adapter (Gemini Nano / Gemini Cloud / Anthropic / LM Studio)
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

No build step for the extension — edit files, reload the extension card.

```bash
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
