# Intent — Product Design Document

## Problem

I save things constantly — bookmarks, tabs, screenshots, clipboard snippets — and almost never revisit them. The core failure is not storage, it's meaning. When you saved something six months ago, you saved *what* it was (a URL, a title, a quote) but not *why* it mattered to you at that moment. Without the why, retrieval is a guessing game and the saved item is effectively dead.

Existing tools (Pocket, Readwise, browser bookmarks, Notion clipper) optimise for quantity and surface area. They make it easy to accumulate but hard to recall.

**The key insight:** the 3–10 seconds immediately after saving are the only moment where the *why* is effortless to capture. If you miss that window, it's gone. No tool I found was designed around this constraint.

---

## Solution

Intent intercepts that window. Select text → shortcut → the extension immediately:

1. Shows "Understanding intent…" toast — user knows something is happening
2. Sends the selected text, URL, and page title to an LLM
3. Gets back a structured capture: intent category, concise title, one-sentence reason, key extract, and 3–5 conceptual tags
4. Stores it in `chrome.storage.local` first — before any async work completes
5. Pushes to the desktop dashboard's SQLite database via a local HTTP server

The user never types a reason — the LLM infers it from context. The result is a growing, searchable, browsable memory layer that preserves *what you were thinking*, not just what you clicked.

---

## Users

**Primary:** knowledge workers, researchers, and students who read heavily online and want a second brain without the friction of manual tagging or note-taking.

**Secondary:** anyone building a reading habit (non-fiction readers, course learners) who wants retrospective access to ideas they encountered.

**Not targeted:** casual users who want cloud sync and mobile access. Intent is deliberately local-first and desktop-focused for now.

---

## Feature set

### Capture

| Feature | Detail |
|---------|--------|
| Keyboard shortcut | `Ctrl+Alt+S` / `Cmd+Alt+S` — works on any page, any selection |
| Popup quick-capture | Type a thought directly; attaches current URL |
| Classification | 8 intent types: book, movie, article, idea, quote, product, recipe, other |
| Auto-reason | LLM writes a one-sentence "why this mattered" |
| Auto-tags | LLM suggests 3–5 lowercase conceptual tags |
| Offline-first | Stored to `chrome.storage.local` before LLM call begins |

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

**No required accounts.** The extension works with any of four LLM providers (including Chrome's built-in Gemini Nano, which requires no key). The desktop app works without Supabase. The only hard requirement is Chrome 127+ for Gemini Nano, or an API key for any cloud provider.

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

The extension lives in the browser sandbox; the Electron app lives in a native process. They cannot share memory or use OS IPC. The solution: `http.createServer` on `127.0.0.1:47832` inside Electron. The extension calls `fetch('http://localhost:47832/captures', ...)` — a standard browser API that works in MV3 service workers without special permissions beyond `host_permissions`.

The server accepts connections only from `127.0.0.1` / `::1`, checked at the socket level before any body is parsed.

### Idempotency

The MV3 service worker is killed after ~30 s of inactivity. Any capture made while Electron was closed will sit in `chrome.storage.local`. On the next service worker start, `replayCapturesToLocal()` sends every capture to the HTTP server. The SQLite upsert uses:

```sql
ON CONFLICT(id) DO UPDATE SET …
  deleted_at = COALESCE(captures.deleted_at, excluded.deleted_at)
```

This ensures replays cannot un-delete a capture the user explicitly removed from the dashboard. The extension always sends `deleted_at: null`, so the existing value wins when non-null.

### Real-time push

When the HTTP server receives `POST /captures`, it immediately calls `win.webContents.send('captures-updated')`. The renderer listens via `ipcRenderer.on('captures-updated')` (exposed through `contextBridge`) and re-fetches from SQLite. Push model — no polling in Electron mode.

For browser dev mode (Vite at `localhost:5173`), there is no IPC. `setInterval(fetchCaptures, 5000)` polls the HTTP server and refreshes the grid when the count changes.

### LLM provider strategy

The extension defaults to **Gemini Nano** — Chrome's built-in AI, on-device, no key, no external call. If the device doesn't support it, it falls back to Gemini Cloud (if a key is configured). Users can also select Anthropic (uses Haiku) or a local LM Studio instance. The desktop dashboard uses the same three cloud/local options for re-classification and distillation.

Haiku is used when Anthropic is selected — classification is a narrow structured-output task with an 8-class schema and a short prompt. Haiku handles it at one-third the cost of Sonnet with no measurable accuracy difference on this shape of task.

---

## Design decisions and trade-offs

| Decision | Why | Tradeoff |
|----------|-----|----------|
| Local HTTP server over native messaging | Zero install on user's machine; no OS manifest required | Port conflict possible (mitigated by `127.0.0.1` binding only) |
| `node:sqlite` over `better-sqlite3` | No native add-on, no build step, requires Electron 41+ | Synchronous API only — acceptable for local single-user use |
| Soft-delete over hard delete | Replay idempotency; deletions survive SW restarts | Deleted rows accumulate; all queries need `WHERE deleted_at IS NULL` |
| Full replay on every SW start | Captures never lost even if Electron is closed | O(n) upserts on every restart — fine at personal scale, breaks at thousands |
| Gemini Nano as default | No friction, no key, fully on-device | Availability varies by device/Chrome version; fallback chain required |
| Vanilla JS + Vite over React | No runtime dependency; fast load from `file://` | No component model; manual DOM manipulation |

---

## Failure modes

**What happens if Electron is not running when a capture is made?**
The capture is saved to `chrome.storage.local` immediately. When Electron starts and the service worker next runs (on the next capture), `replayCapturesToLocal()` sends all pending captures to SQLite. No data is lost — the window between capture and dashboard sync is just longer.

**What happens if the LLM call fails?**
The classify function catches errors and returns a fallback result (`intent: "other"`, `title: "Untitled capture"`). The capture is always saved — classification failure is not a data loss event.

**What happens if the HTTP server port is already in use?**
The server call throws a Node `EADDRINUSE` error, which currently crashes the Electron startup. This is a known gap — the app should detect the conflict and either try the next port or show an error dialog.

**What happens if the same capture is replayed after a dashboard edit?**
The `ON CONFLICT DO UPDATE` handles all fields *except* deletes correctly — edits made in the dashboard (title, reason, tags) will be overwritten by the replay since the extension's version is treated as authoritative. This is a known gap: edits made only in the dashboard can be lost on replay.

---

## Known limitations and what I'd improve next

1. **High-water-mark replay** — The full O(n) replay should be replaced with a last-synced timestamp. Only captures newer than that timestamp get replayed. This makes replay O(new) instead of O(all).

2. **Unified settings** — The extension and dashboard have separate LLM settings stores (`chrome.storage.sync` vs `localStorage`). They should share a single source of truth, probably via the HTTP server's `/settings` endpoint which already exists.

3. **Extension-side delete → dashboard** — Deleting in the extension popup removes the item from `chrome.storage.local` but doesn't POST a soft-delete to the HTTP server. A replay would resurrect it. The fix is to call `softDeleteLocal(id)` in the `DELETE_CAPTURE` handler.

4. **Port conflict handling** — If port 47832 is taken, Electron crashes silently. Should detect `EADDRINUSE` and surface a user-facing error or try an adjacent port.

5. **Edit conflict resolution** — Last write wins. For a single-user local tool this is rarely a problem, but a simple vector clock or `updated_at` timestamp comparison would eliminate the edge case entirely.

---

## Out of scope (current version)

- Mobile (requires native app)
- Multi-device sync without Supabase
- Full-text semantic / embedding search
- Highlight replay / web annotation
- Collaboration or sharing
