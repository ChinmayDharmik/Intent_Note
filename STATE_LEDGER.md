# State Ledger
**Project:** Intent
**Last Updated:** 2026-04-22 (FEAT-08 complete)

---

## 0. ACTIVE TASK

| ID | Task | Started |
|----|------|---------|
| — | — | — |

**Files in scope:** —

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
| V2-PHASE-1 | Visual Sanctuary — warm palette, Noto Serif + Manrope, no-line borders, Mica blur, cursor-following radial glow | 2026-04-21 |
| V2-PHASE-2 | Supabase Sync — offline-first upsert from background.js, Supabase settings fields, sync-status indicator, manifest host_permissions | 2026-04-21 |
| V2-PHASE-3 | Companion Web App (`/web`) — Vite + vanilla JS, Supabase feed, asymmetric grid, detail view with lazy distillation | 2026-04-21 |
| V2-PHASE-4 | Research Mode — Obsidian-compatible Markdown export with frontmatter + distillation bullets, bulk zip from web app | 2026-04-21 |
| DIST-01 | Chrome Web Store prep — version 1.1.0, local font bundle (src/fonts/ + src/fonts.css), CDN removed from CSP, privacy-policy.html | 2026-04-21 |
| DIST-02 | Store listing assets — store/promo-tile.svg, store/listing-copy.md (short/long desc, screenshot spec, metadata table) | 2026-04-21 |
| FEAT-06 | Add Gemini Nano (Built-in AI, default) + Gemini Cloud providers; fallback chain Nano→Cloud; settings UI updated | 2026-04-21 |
| FIX-04 | Selection pre-capture in content.js — fixes highlight lost before executeScript executes on shortcut | 2026-04-21 |
| FEAT-07 | Free-form multi-tag support — LLM auto-suggests tags, user can add/remove inline, tag cloud filter bar above tabs | 2026-04-21 |
| FEAT-08 | Editable captures — title, reason, intent, tags; Re-classify (reshuffle) button; extension popup inline form + web app detail edit mode | 2026-04-22 |

---

| TEST-01 | End-to-end smoke test — passed | 2026-04-18 |
---

## 3. NEXT IN QUEUE

| ID | Task | Depends On |
|----|------|-----------|
| DIST-03 | Submit to Chrome Web Store — zip extension folder, upload, fill listing form, submit for review | DIST-02 |

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
- 2026-04-21 — PRD v2.0 adopted. Project vision expanded to "Digital Sanctuary" — journaling/reflection system with dual-platform architecture.
- 2026-04-21 — Sync backend: Supabase (Postgres + REST API). Extension uses plain fetch, no SDK, to avoid MV3 CSP issues.
- 2026-04-21 — Both extension and web app adopt warm light theme (#fdf9f5 / #f7f3ef). DM Serif Display + DM Sans replaced by Noto Serif + Manrope.
- 2026-04-21 — Distillation (US-12) is lazy: triggered on detail view open, not at capture time. Cached to Supabase after first call.
- 2026-04-21 — Web app lives in /web (same repo). Stack: Vite + vanilla JS. Revisit React if grid complexity demands it at Phase 3 start.
- 2026-04-21 — Soft-delete strategy confirmed and implemented: deleted captures get deleted_at timestamp via PATCH, not hard-deleted from Supabase.
- 2026-04-21 — DIST-01: Fonts bundled locally to remove Google Fonts CDN dependency; eliminates fonts.googleapis.com / fonts.gstatic.com from CSP, which can flag during Chrome Web Store review.
- 2026-04-22 — FEAT-08: "No editing" constraint overridden by explicit user request. Editable fields: title, reason, intent, tags. Re-classify sends rawText through the full classify() pipeline and pre-fills the edit form without auto-saving.
