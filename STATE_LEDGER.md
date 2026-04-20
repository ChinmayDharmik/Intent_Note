# State Ledger
**Project:** Intent
**Last Updated:** 2026-04-18

---

## 1. COMPLETED

| ID | Task | Completed |
|----|------|-----------|
| TASK-01 | Verify manifest.json scaffold | 2026-04-18 |
| TASK-02 | background.js — message routing, storage CRUD, shortcut handler | 2026-04-18 |
| TASK-04 | content.js — toast system (spinner, success, error, info states) | 2026-04-18 |
| FE-01 | popup.html + popup.js — feed, filter tabs, quick capture, delete, error banner | 2026-04-18 |
| FE-02 | popup.css — full UI system (header, card, badge, empty state, shimmer overlay) | 2026-04-18 |
| FE-03 | settings.html + settings.js — provider toggle, API key input, test connection | 2026-04-18 |
| FE-04 | settings.css — settings page UI | 2026-04-18 |
| FIX-01 | Rewrite src/llm.js — classify(), loadSettings(), saveSettings() | 2026-04-18 |
| FIX-02 | background.js:172 — replace self-sendMessage with direct handleSave() call | 2026-04-18 |
| FIX-03 | settings.js — fix model ID to claude-sonnet-4-6 | 2026-04-18 |
| FE-05 | popup.css + popup.js — loading spinner on save button during quick capture | 2026-04-18 |
| FEAT-01 | Implement Search / Text Filter in popup UI | 2026-04-18 |
| FEAT-02 | Export captures (JSON/Markdown download) | 2026-04-20 |
| FEAT-04 | Show capture count per intent tab (badge) | 2026-04-20 |
| FEAT-05 | Attach-page toggle on quick capture bar | 2026-04-20 |

---

| TEST-01 | End-to-end smoke test — passed | 2026-04-18 |
---

## 3. NEXT IN QUEUE

| ID | Task |
|----|------|

## 4. BLOCKED / PARKED

| ID | Task | Blocked By | Since |
|----|------|-----------|-------|

---

## 5. DECISIONS LOG

- 2026-04-18 — Project initialised from PRD. Stack: Vanilla JS ES modules / Chrome Extension MV3 / chrome.storage.local / no build step.
- 2026-04-18 — LLM backend: LM Studio (localhost:1234) for dev, Anthropic claude-sonnet for demo. Single llm.js adapter, backend is a config value.
- 2026-04-18 — No automated test runner chosen; manual testing via Chrome DevTools.
- 2026-04-18 — Storage split confirmed: captures → chrome.storage.local, settings → chrome.storage.sync (key: "intentSettings"). llm.js must read sync, not local.
- 2026-04-18 — No-selection shortcut behaviour: save page as article (pageTitle + URL as text). Not "select text first" toast. Matches actual implementation, PRD v1.1 updated to reflect.
- 2026-04-18 — llm.js found to contain a copy of background.js. FIX-01 set as active task — this is the sole functional blocker.
