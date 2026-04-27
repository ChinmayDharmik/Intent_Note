# Intent — Demo Script

Target length: ~3 minutes. Recorded screen + voiceover.

---

## Scene 1 — The problem (0:00–0:20)

**Screen:** Browser tab open to a long article or book review. Scroll slowly through it.

> "We all save things constantly — bookmarks, open tabs, highlights. But six months later, you have no idea why you saved any of it. Just a graveyard of URLs with no context."

> "Intent fixes that. It captures the *why* — automatically — at the exact moment it's fresh."

---

## Scene 2 — First capture (0:20–0:55)

**Screen:** Select a paragraph of text on the article. Press `Ctrl+Shift+S`.

> "Select any text and press the shortcut."

**Screen:** Toast slides in from bottom-right — a spinner with "Understanding intent…". A moment later it swaps to a success toast: intent emoji, inferred title in bold, inferred reason below it in muted text.

> "In the background, the selected text, the URL, and the page title go to an LLM. It classifies the intent, writes a title, infers a one-sentence reason why this mattered, and suggests tags. Everything happens in about two seconds."

> "By default Intent uses Chrome's built-in Gemini Nano — completely on-device, no API key, no network call. If you want cloud quality, switch to Gemini Cloud, Anthropic, or a local LM Studio instance in Settings."

**Screen:** Click the extension icon. Show the capture in the popup with its intent badge, title, reason, and tags.

> "The result is structured: an intent category, a title, the reason, and conceptual tags — all inferred, none typed."

---

## Scene 3 — Dashboard sync (0:55–1:30)

**Screen:** Switch to the Electron desktop app already open on the side. The new capture appears in the grid in real-time — no refresh.

> "The desktop dashboard is a companion Electron app. It's running a local SQLite database and a tiny HTTP server. The extension pushes every capture to that server — fire and forget."

> "The server writes to SQLite, then sends an IPC event to the renderer. The grid updates immediately."

**Screen:** Pan across the dashboard. Show cards with different intent categories (article, book, idea, quote). Click the filter rail — "📚 Books" — grid filters.

> "Cards are grouped by intent. Click a filter — you're browsing only your book captures. Click a tag in the sidebar — cross-intent tag filter."

---

## Scene 4 — Detail and distillation (1:30–2:00)

**Screen:** Click on an article capture. Detail view opens. Show the title, reason, source link (click it — opens system browser).

> "Every capture links back to the source. Click the link — it opens in your default browser, not a new Electron window."

**Screen:** The distillation section shows a spinner with "Distilling…". Three bullet points appear.

> "Distillation runs an LLM pass to extract three key insights. The result is cached in SQLite — it never re-runs for the same capture."

---

## Scene 5 — Edit and delete (2:00–2:25)

**Screen:** Click Edit. Change the intent from Article to Idea. Update a tag. Click Save.

> "Everything is editable. Title, reason, intent, tags. You can also trigger a full re-classification with one click — the LLM re-reads the original text."

**Screen:** Click Delete. Capture disappears from grid.

> "Deleting is a soft-delete — the record gets a `deleted_at` timestamp in SQLite. If the extension service worker replays the capture later, the deletion survives. The upsert uses `COALESCE` so it can never be overwritten by a replay."

---

## Scene 6 — Architecture close (2:25–3:00)

**Screen:** Split between the extension popup and the Electron app. Make one more capture — watch it arrive in real-time.

> "The whole system is local. No cloud account. No hosting. The extension stores everything in `chrome.storage.local`. The Electron app stores everything in SQLite via Node's built-in `node:sqlite` — no native add-ons, no build step."

> "The only bridge is a plain HTTP server on `localhost:47832`. The extension uses `fetch` — a standard browser API — to push captures. The server checks the socket address and rejects anything that isn't loopback."

> "The service worker is ephemeral — it gets killed after 30 seconds of inactivity. So on every restart, it replays the entire local capture list to SQLite. `ON CONFLICT(id) DO UPDATE` makes that safe to run any number of times."

> "The default LLM is Chrome's built-in Gemini Nano — no API key, no external call, fully on-device. For higher quality output, swap to Gemini Cloud, Anthropic, or LM Studio in settings."

**Screen:** Show the GitHub repo briefly.

> "Everything is open source. The extension loads unpacked — no Chrome Web Store needed. And if you want a packaged installer, `npm run dist` outputs one via electron-builder."

---

## Key talking points (for live demo / Q&A)

- **Why local-first?** Avoids the need for a backend, removes the trust problem, and makes it work offline. The default LLM (Gemini Nano) is on-device — no external network call at all. Cloud providers are opt-in.

- **Why a local HTTP server instead of native messaging?** Native messaging requires a host manifest installed on the OS — user setup friction. An HTTP server on loopback is a standard API that works everywhere with zero install.

- **Why `node:sqlite` instead of `better-sqlite3`?** No native add-on means no `node-gyp`, no platform-specific binaries to bundle in the Electron installer. It's been stable in Node 22 since 2024.

- **Why soft-delete with COALESCE?** The service worker replay creates a tension: the extension doesn't know about deletions made in the dashboard. Hard-coding `deleted_at = null` in the replay would un-delete things. COALESCE preserves whichever side has a non-null deletion.

- **Why Gemini Nano as the default?** Zero friction — no API key, no account, no cost. It runs entirely in Chrome using Chrome's built-in AI APIs. If the device doesn't support it, the extension falls back to Gemini Cloud if a key is set. Power users can swap to Anthropic Haiku or a local LM Studio model.

- **Why Haiku when using Anthropic?** Classification is a narrow structured-output task with an 8-class schema and a short prompt. Haiku handles it at one-third the cost of Sonnet with no measurable accuracy difference on this task shape.
