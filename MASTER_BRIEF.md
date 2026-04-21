# Intent – Master Brief

## 1. Project Overview
- **Name:** Intent
- **Version:** v2.0 (PRD updated 2026-04-21)
- **Purpose:** A "Digital Sanctuary" — captures *why* a user saved something, not just the content. Journaling and reflection system with a premium editorial UI.
- **Core Flow:** Shortcut → selection → LLM classification → local save + Supabase sync → popup UI + companion web dashboard.

## 2. Architecture

### Extension (Capture Layer)
- **Manifest (MV3)**
- **Background Service Worker (`src/background.js`)** — shortcut, storage CRUD, LLM orchestration, Supabase sync upsert.
- **Content Script (`src/content.js`)** — toasts, selection script injection.
- **Popup UI (`popup.html`, `src/popup.js`, `src/popup.css`)** — feed, tabs, quick capture, search, export, delete, sync-status dot.
- **Settings UI (`settings.html`, `src/settings.js`, `src/settings.css`)** — LLM provider toggle, API keys, Supabase credentials.
- **LLM Adapter (`src/llm.js`)** — abstracts Anthropic & LM Studio, retry, JSON fallback.

### Web App (`/web` — Reflection Layer)
- **Stack:** Vite + vanilla JS (revisit React if asymmetric grid complexity warrants it at Phase 3 start)
- **`/web/src/supabase.js`** — thin REST wrapper (mirrors background.js fetch pattern)
- **`/web/src/llm.js`** — adapted from extension's llm.js for browser context
- **Views:** Feed (asymmetric grid), Detail (distillation + full text), Library, Archive
- **Navigation Rail** — Mica-effect sidebar, no borders

### Storage
- `chrome.storage.local["captures"]` — primary store, offline-first
- `chrome.storage.sync["intentSettings"]` — LLM provider, API key, model ID, Supabase URL + anon key
- **Supabase (Postgres)** — sync target; extension upserts after each local save
- `localStorage` (web app) — Supabase URL, anon key, Anthropic key

### Data Model (capture object)
```json
{
  "id": "...",
  "intent": "book|movie|article|idea|quote|product|recipe|other",
  "title": "...",
  "reason": "...",
  "extract": "...",
  "rawText": "...",
  "url": "...",
  "pageTitle": "...",
  "savedAt": "ISO-8601",
  "intentMeta": {"label":"...","emoji":"...","color":"..."},
  "distillation": null
}
```
`distillation` is null at capture time; populated lazily when detail view is first opened.

## 3. Design System (v2 — "Digital Sanctuary")

| Token | Value |
|---|---|
| Primary surface | `#fdf9f5` |
| Secondary surface | `#f7f3ef` |
| Cards | white, floating on tonal background |
| Borders | **Prohibited** — background color shifts only |
| Mica effect | `backdrop-filter: blur(20px–40px)` on floating elements |
| Display / headlines | Noto Serif |
| UI / body / labels | Manrope |
| Hover | Radial gradient "glow" follows cursor on primary elements |

## 4. Architectural Decisions & Rationale
- **Offline-first + Supabase sync:** Local save never blocked by network; sync fires async after local write succeeds.
- **No Supabase SDK in extension:** Plain `fetch` calls avoid bundling and MV3 CSP issues.
- **Soft-delete in Supabase:** Captures get `deleted_at` timestamp — web app filters; no data loss.
- **Lazy distillation:** Keeps capture flow fast (< 2s target); detail view absorbs extra LLM latency.
- **LLM-first classification:** Handles ambiguous text better than rule-based regex.
- **Fallback to `other` intent:** No capture is ever lost on malformed LLM response.
- **No build step (extension):** Plain ES modules, load unpacked directly.
- **Separate storage tiers:** Captures (large, local) vs. settings (tiny, sync quota).

## 5. Completed Tasks
| ID | Task | Completed |
|----|------|-----------|
| TASK-01 | `manifest.json` scaffold | 2026-04-18 |
| TASK-02 | `background.js` CRUD & shortcut | 2026-04-18 |
| TASK-04 | `content.js` toast system | 2026-04-18 |
| FE-01–05 | Popup UI, CSS, Settings UI, CSS, spinner | 2026-04-18 |
| FIX-01–03 | llm.js rewrite, background bug, model ID | 2026-04-18 |
| FEAT-01 | Search / text filter | 2026-04-18 |
| FEAT-02 | Export (JSON + Markdown) | 2026-04-20 |
| FEAT-04 | Per-intent badge counts | 2026-04-20 |
| FEAT-05 | Attach-page toggle on quick capture | 2026-04-20 |
| TEST-01 | End-to-end smoke test — passed | 2026-04-18 |

## 6. Active Task
**V2-PHASE-1** — Visual Sanctuary: migrate extension UI to v2 design system.  
Files: `src/popup.css`, `src/settings.css`, `popup.html`, `settings.html`

## 7. Roadmap

| Phase | Goal | Key Deliverable |
|-------|------|----------------|
| **1 — Visual Sanctuary** | Extension UI overhaul | Warm palette, Noto Serif + Manrope, no-line borders, Mica, glow |
| **2 — Supabase Sync** | Extension → Supabase pipeline | `syncToSupabase()`, settings fields, sync-status indicator |
| **3 — Companion Web App** | Reflection Layer (`/web`) | Asymmetric feed, detail view, lazy distillation |
| **4 — Research Mode** | Obsidian-compatible export | Markdown frontmatter + distillation, bulk zip |

## 8. Open Decisions (flag before each phase)
| Decision | Phase | Recommendation |
|---|---|---|
| Soft-delete vs hard-delete in Supabase | 2 | Soft-delete (`deleted_at`) |
| Web app framework: Vite vanilla vs React | 3 | Vite vanilla — revisit if grid complexity demands it |
| Distillation model: same as classify or dedicated call | 3 | Same model, second LLM call |
| Obsidian tag source: LLM-generated or user-editable | 4 | LLM-generated at distillation time |

## 9. Testing & Linting
- Manual smoke-test: load unpacked → Chrome DevTools on background worker → trigger capture paths
- `npx eslint src/` for style consistency
- Web app: `vite dev` in `/web`, verify feed loads from Supabase

## 10. Quick Reference
```bash
# Reload extension
# chrome://extensions → Reload

# Lint
npx eslint src/

# Web app dev server (Phase 3+)
cd web && npx vite
```

---
**How to use:** Single source of truth for design reviews and sprint planning. Update phases and decisions as the project evolves.
