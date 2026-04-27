# Intent — Demo Script

Target length: 5–7 minutes. Recorded screen + voiceover.

Structure mirrors Damco's evaluation criteria: problem framing → live demo → design decisions → trade-offs → failure modes → honest self-assessment.

---

## Part 1 — The problem (0:00–1:00)

**Screen:** Browser tab open to a long article. Scroll slowly through it. Then open a browser bookmarks folder full of saved links — dozens of titles with no context.

> "I read a lot. And I save a lot — bookmarks, Pocket, Notion clipper, open tabs. The problem isn't that I don't save things. It's that six months later I open this folder and I have no idea why I saved any of it."

> "The URL is there. The title is there. But the context — why this mattered to me in that moment — is gone."

> "I thought about this for a while. The *why* is effortless to articulate in the 5–10 seconds right after you save something. It's fresh. You're still in the thought. If you don't capture it in that window, it's gone."

> "And yet every tool I looked at — Pocket, Readwise, browser bookmarks — optimises for accumulation. None of them are designed around the timing constraint. They assume you'll come back and tag things manually. You won't."

> "So I built Intent. The idea is simple: intercept that window. Make capturing the why as frictionless as capturing the what."

---

## Part 2 — Live demo (1:00–3:30)

### 2a — Capture (1:00–2:00)

**Screen:** Open an article page. Highlight a paragraph.

> "The flow: select any text, press the shortcut."

**Screen:** Press `Ctrl+Shift+S`. Toast slides in — spinner with "Understanding intent…"

> "In the background: the selected text, the URL, and the page title go to an LLM. By default that's Chrome's built-in Gemini Nano — completely on-device, no API key, no network call. For higher quality output you can swap to Gemini Cloud, Anthropic, or a local LM Studio instance."

**Screen:** Toast transitions — intent emoji appears, inferred title in bold, inferred reason below in muted text.

> "The LLM returns a structured object: an intent category from a fixed 8-class schema, a concise title, a one-sentence reason why this mattered, a key extract, and 3–5 conceptual tags. All inferred. None typed."

**Screen:** Click the extension icon. Show the capture in the popup with badge, title, reason, tags.

> "Open the popup — there it is. Structured, categorised, with a reason attached. The whole thing takes about two seconds."

### 2b — Dashboard (2:00–2:45)

**Screen:** Switch to the Electron desktop app. The capture just made appears in the grid in real-time.

> "The desktop dashboard is a companion Electron app. It's running a local SQLite database and a tiny HTTP server. The extension pushes every capture to that server — fire and forget."

> "The server writes to SQLite, then sends an IPC event to the renderer. No polling. The card appears immediately."

**Screen:** Pan the grid — show mixed intent categories. Click the Books filter. Grid filters.

> "Cards are grouped by intent. Filter to Books — you're browsing only book captures. Click a tag in the sidebar for a cross-intent view."

### 2c — Detail, distillation, edit, delete (2:45–3:30)

**Screen:** Click a card. Detail view opens. Click the source link — opens in system browser.

> "Every capture links back to the source. Click the link — it opens in the default browser, not an Electron window."

**Screen:** Distillation spinner → three bullet points appear.

> "Distillation runs a second LLM pass to extract three key insights. Cached in SQLite — it never re-runs for the same capture."

**Screen:** Click Edit. Change intent, update a tag. Click Save.

> "Everything is editable. One click also triggers full re-classification — the LLM re-reads the original text."

**Screen:** Click Delete. Card disappears from grid.

> "Delete is soft — sets a `deleted_at` timestamp. More on why that matters in a moment."

---

## Part 3 — System design (3:30–5:00)

**Screen:** Switch to code editor or a simple architecture diagram. Talk through the key decisions.

### The bridge problem

> "The hardest constraint I had to work around: Chrome extensions run in a browser sandbox. The Electron app runs in a native process. They can't share memory. They can't use OS IPC directly."

> "The standard solution is native messaging — but that requires installing a host manifest on the OS, which is friction I didn't want to impose on users."

> "My solution: a plain `http.createServer` on `127.0.0.1:47832` inside Electron. The extension uses `fetch` — a standard browser API — to push captures. Zero install. Works on every OS. The server does a socket-level IP check and rejects anything that isn't loopback, so nothing external can reach it."

### Idempotency and the replay problem

> "MV3 service workers are ephemeral — Chrome kills them after 30 seconds of inactivity. So if you made captures while Electron was closed, those captures are sitting in `chrome.storage.local` and the desktop app doesn't know about them."

> "My fix: every time the service worker starts, it replays the entire `chrome.storage.local` array to the HTTP server. Every capture. Every time."

> "But that creates a new problem: what if the user deleted a capture from the dashboard while the service worker was dead? A naive replay would resurrect it."

> "I solved that at the SQL layer. The upsert uses `ON CONFLICT(id) DO UPDATE` with `COALESCE(captures.deleted_at, excluded.deleted_at)`. The extension always sends `deleted_at: null`. COALESCE means: if the existing row already has a deletion timestamp, keep it — don't let the replay overwrite it. So deletions survive replay without any application-layer logic."

### Why `node:sqlite`

> "I used Node 22's built-in `node:sqlite` instead of `better-sqlite3`. The reason: no native add-on. `better-sqlite3` requires `node-gyp` to compile C++ bindings, which means platform-specific binaries in the installer. With `node:sqlite`, there's nothing to compile. The installer is smaller and simpler. The trade-off is a synchronous-only API, but for a single-user local tool that's completely fine."

---

## Part 4 — Trade-offs and failure modes (5:00–6:15)

**Screen:** Keep the code visible or return to the dashboard.

> "Let me be honest about where this design breaks down."

### The replay doesn't scale

> "The full replay is O(n). If a user has a thousand captures, the service worker restart sends a thousand HTTP requests to the local server. At personal scale that's fine — it finishes in under a second. But it doesn't scale. The right fix is a high-water-mark: store the timestamp of the last successful sync and only replay captures newer than that. I haven't built that yet."

### Edits in the dashboard can be lost

> "If you edit a capture's title or tags in the dashboard, and then the service worker replays that capture from the extension's copy, the dashboard edits get overwritten. The extension's version is treated as authoritative by the upsert. This is a real gap. The fix is to either include an `updated_at` field and only overwrite if the incoming version is newer, or push edits from the dashboard back to the extension's storage."

### Separate settings stores

> "The extension stores LLM provider config in `chrome.storage.sync`. The dashboard stores it in `localStorage`. They're independent. If you change your API key in the extension, the dashboard doesn't know. The HTTP server already has a `/settings` endpoint — the right move is to make the dashboard fetch settings from there on boot, so there's one source of truth."

### Port conflict

> "If port 47832 is already in use, Electron throws `EADDRINUSE` and the app fails silently. I should catch that, show an error dialog, and either offer an adjacent port or a way to configure it. That's just missing error handling."

### Extension delete doesn't reach the dashboard

> "Deleting a capture in the extension popup removes it from `chrome.storage.local` but doesn't POST a soft-delete to the HTTP server. If a replay happens before the user opens the dashboard, the capture reappears there. The fix is a one-liner — call `softDeleteLocal(id)` in the `DELETE_CAPTURE` message handler. I just haven't done it yet."

---

## Part 5 — Wrap-up (6:15–7:00)

**Screen:** Show the repo. Optionally show the packaged installer or `npm run dist` output.

> "To summarise what I think works well: the core timing insight is right — the window is real, and capturing in it changes how useful saved items become. The local-first architecture means it works offline, requires no accounts, and nothing leaves your machine except LLM API calls — and even those are optional with Gemini Nano."

> "The two things I'd fix next: the high-water-mark replay, and the edit-conflict problem. Both are solvable and both have clear solutions — I just ran out of time to implement them before recording this."

> "The whole system is open source. Extension loads unpacked. `npm run dist` in the web directory builds an installable Electron app via electron-builder."

---

## Q&A talking points

- **Why local-first?** Avoids backend cost, removes the trust problem, works offline. The only external dependency is an LLM API call — and with Gemini Nano as default, even that is on-device.

- **Why a local HTTP server instead of native messaging?** Native messaging requires a host manifest installed on the OS. HTTP on loopback is a standard API — zero install, works everywhere.

- **Why `node:sqlite`?** No native add-on means no `node-gyp`, no platform binaries in the installer. Stable in Node 22 since 2024.

- **Why soft-delete?** The service worker replay has no knowledge of deletions. Soft-delete + COALESCE at the SQL layer is the cleanest way to make replay idempotent without adding application-layer deletion tracking.

- **Why Gemini Nano as default?** Zero friction. No key, no account, no cost, fully on-device. Graceful fallback to cloud if the device doesn't support it.

- **Why Haiku when using Anthropic?** Classification is a narrow structured-output task with a fixed 8-class schema and a ~220-char prompt. Haiku handles it at one-third the cost of Sonnet with no measurable accuracy difference on this task shape.

- **What's the biggest design mistake?** Probably the full O(n) replay. It works today but it's technically incorrect — it should be delta-based. The COALESCE trick works around the worst consequence (un-deleting items) but doesn't fix the underlying scalability issue.
