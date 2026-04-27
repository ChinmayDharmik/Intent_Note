# Intent — Product Design Document

## Problem

People save things constantly — bookmarks, tabs, screenshots, clipboard snippets — and almost never revisit them. The core failure is not storage, it's meaning. When you saved something six months ago, you saved *what* it was (a URL, a title, a quote) but not *why* it mattered to you at that moment. Without the why, retrieval is a guessing game and the saved item is effectively dead.

Existing tools (Pocket, Readwise, browser bookmarks, Notion clipper) optimise for quantity and surface area. They make it easy to accumulate but hard to recall.

**The insight:** the 3–10 seconds immediately after saving are the only moment where the why is effortless to capture. If you miss that window, it's gone.

---

## Solution

Intent intercepts that window. Select text → shortcut → the extension immediately:

1. Sends the selected text, URL, and page title to an LLM
2. Gets back a structured capture: intent category, concise title, one-sentence reason, key extract, and 3–5 conceptual tags
3. Stores it locally and syncs it to a desktop dashboard in real-time

The user never types a reason — the LLM infers it from context. The result is a growing, searchable, browsable memory layer that preserves *what you were thinking*, not just what you clicked.

---

## Users

**Primary:** knowledge workers, researchers, and students who read heavily online and want to build a second brain without the friction of manual tagging or note-taking.

**Secondary:** anyone building a reading habit (non-fiction readers, course learners) who wants retrospective access to ideas they encountered.

**Not targeted:** casual users who want cloud sync and mobile access. Intent is deliberately local-first and desktop-focused.

---

## Feature set

### Capture

| Feature | Detail |
|---------|--------|
| Keyboard shortcut | `Ctrl+Shift+S` / `Cmd+Shift+S` — works on any page, any selection |
| Popup quick-capture | Type a thought directly; attaches current URL |
| Page link toggle | Optionally include the source URL in the capture |
| Classification | 8 intent types: book, movie, article, idea, quote, product, recipe, other |
| Auto-reason | LLM writes a one-sentence "why this mattered" |
| Auto-tags | LLM suggests 3–5 lowercase conceptual tags |

### Browse

| Feature | Detail |
|---------|--------|
| Real-time dashboard | New captures appear in Electron within seconds — no refresh |
| Filter rail | Tabs per intent type with live counts |
| Tag cloud | Click any tag to filter across all intents |
| Search | Full-text across title, reason, raw text |

### Manage

| Feature | Detail |
|---------|--------|
| Inline edit | Update title, reason, intent, or tags from detail view |
| Re-classify | One-click LLM re-run on existing capture |
| Distillation | LLM extracts 3 key insights; result cached so it never re-runs |
| Delete | Soft-delete from dashboard; COALESCE preserves deletion across replays |
| Export | Per-capture or bulk Markdown; bulk ZIP from dashboard |

---

## Technical design

### Principles

**Local-first.** Every capture is stored in `chrome.storage.local` before any async work. The LLM call, local HTTP push, and Supabase sync are all fire-and-forget — a network failure never loses a capture.

**No required accounts.** The extension works with any of three LLM providers. The desktop app works without Supabase. The only credential needed is an LLM API key (or a local LM Studio instance).

**Zero-infra desktop app.** Electron + `node:sqlite` (Node 22 built-in) means no cloud database, no Docker, no environment variables to manage. The app ships as a single installer.

### Storage layers

```
chrome.storage.local          — source of truth for the extension
  ↓  sync (fire-and-forget)
SQLite via node:sqlite        — source of truth for the dashboard
  ↓  optional secondary sync
Supabase                      — cloud backup, only if configured
```

### Communication bridge

The extension lives in the browser sandbox; the Electron app lives in a native process. They cannot share memory or communicate via OS IPC. The solution: a `http.createServer` on `127.0.0.1:47832` inside Electron. The extension calls `fetch('http://localhost:47832/captures', ...)` — a standard browser API that works in MV3 service workers without special permissions beyond `host_permissions`.

The server accepts connections only from `127.0.0.1` / `::1`, checked at the socket level before any body is parsed.

### Idempotency

The MV3 service worker is killed after ~30 s of inactivity. Any capture made while Electron was closed will sit in `chrome.storage.local`. On the next service worker start, `replayCapturesToLocal()` sends every capture to the HTTP server. The SQLite upsert uses `ON CONFLICT(id) DO UPDATE … COALESCE(existing.deleted_at, incoming.deleted_at)` to ensure replays cannot un-delete a capture the user explicitly removed from the dashboard.

### Real-time push

When the HTTP server receives `POST /captures`, it immediately calls `win.webContents.send('captures-updated')`. The renderer listens via `ipcRenderer.on('captures-updated')` (exposed through `contextBridge`) and re-fetches from SQLite. This is a push model with no polling in Electron mode.

For browser dev mode (Vite at `localhost:5173`), there is no IPC. Instead, `setInterval(fetchCaptures, 5000)` polls the HTTP server and refreshes the grid when the count changes.

### LLM cost control

All LLM calls use `claude-haiku-4-5-20251001` — one-third the cost of Sonnet for structured classification tasks where accuracy on a narrow schema is more important than reasoning depth. The classification prompt is trimmed to ~220 chars (down from ~580 in v1). Distillation results are cached in SQLite so they are never re-computed.

---

## Design decisions and tradeoffs

| Decision | Why | Tradeoff |
|----------|-----|----------|
| Local HTTP server instead of native messaging | Zero install on user's machine; works on all OS | Port conflict possible (mitigated by checking 127.0.0.1 only) |
| `node:sqlite` over better-sqlite3 | No native add-on, no build step, works in any Electron 41+ | Synchronous API only (acceptable for local single-user use) |
| Soft-delete (deleted_at) over hard delete | Replays are idempotent; deletions survive SW restarts | Slightly more complex query; deleted rows accumulate (acceptable at this scale) |
| `chrome.storage.local` as primary + replay over write-through only | Captures are never lost even if Electron is closed | Full replay on every SW start is O(n) POSTs; fine for personal-scale capture counts |
| Haiku over Sonnet | 66% cost reduction for classification tasks | Slightly less creative titles/reasons |
| Vite + vanilla JS over React | Zero runtime dependency; fast to load from `file://` | No component model; DOM manipulation is manual |

---

## Out of scope (current version)

- Mobile (requires native app; out of scope for a local-first desktop tool)
- Multi-device sync without Supabase (would require a custom sync server)
- Full-text semantic search (would require embeddings + vector store)
- Highlight replay / web annotation (would require content script DOM mutation)
- Collaboration / sharing
