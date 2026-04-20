# Intent – Master Brief for Brainstorming

## 1. Project Overview
- **Name:** Intent (Chrome Extension)
- **Purpose:** Capture *why* a user saved something, not just the content.
- **Core Flow:** Shortcut → selection → LLM classification → storage → popup UI.

## 2. Architecture
- **Manifest (MV3)**
- **Background Service Worker (`src/background.js`)** – handles shortcut, storage CRUD, toast orchestration.
- **Content Script (`src/content.js`)** – displays toasts, runs selection script.
- **Popup UI (`popup.html`, `src/popup.js`, `src/popup.css`)** – renders feed, tabs, quick input, delete.
- **Settings UI (`settings.html`, `src/settings.js`)** – LLM provider toggle, API key.
- **LLM Adapter (`src/llm.js`)** – abstracts Anthropic & LM Studio, retries, JSON fallback.
- **Storage Split**
  - `chrome.storage.local["captures"]` – array of capture objects.
  - `chrome.storage.sync["intentSettings"]` – provider, API key, model ID.
- **Data Model (capture object)**
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
  "intentMeta": {"label":"...","emoji":"...","color":"..."}
}
```

## 3. Architectural Decisions & Rationale
- **Local storage only:** No sync, no backend – keeps privacy, zero‑setup.
- **LLM‑first classification:** Handles ambiguous text better than rule‑based regex.
- **`executeScript` for selection:** Guarantees content script is loaded; reliable in MV3.
- **Fallback to `other` intent:** Guarantees no capture is lost on malformed LLM response.
- **Separate storage tiers:** Captures (large) vs. settings (tiny) to respect quota limits.
- **No build step:** Plain ES modules → easier for Chrome unpacked loading.

## 4. Completed Tasks (from `STATE_LEDGER.md`)
| ID | Task | Completed |
|----|------|-----------|
| TASK-01 | Verify `manifest.json` scaffold | 2026-04-18 |
| TASK-02 | `background.js` CRUD & shortcut | 2026-04-18 |
| TASK-04 | `content.js` toast system | 2026-04-18 |
| FE-01 | Popup UI (feed, tabs, quick capture) | 2026-04-18 |
| FE-02 | Popup CSS styling | 2026-04-18 |
| FE-03 | Settings UI | 2026-04-18 |
| FE-04 | Settings CSS | 2026-04-18 |
| FIX-01 | Rewrite `llm.js` | 2026-04-18 |
| FIX-02 | Background self‑message bug → direct `handleSave` | 2026-04-18 |
| FIX-03 | Correct model ID in `settings.js` | 2026-04-18 |
| FE-05 | Loading spinner on quick‑save button | 2026-04-18 |
| PRD-update | Added tooltip titles, post‑MVP roadmap | 2026-04-18 |
| Ledger rename | `_STATE_LEDGER.md` → `STATE_LEDGER.md` | 2026-04-18 |

## 5. Active Task
- **TEST-01** – End‑to‑end smoke test (verify all capture paths, toasts, UI rendering, delete, settings).

## 6. Next‑Queue (empty)

## 7. Phase 2 – Quality‑of‑Life Features (no backend)
1. **Search / Text Filter** – in‑memory filter of feed (high impact).
2. **Export** – JSON (and optional Markdown) download of captures.
3. **Edit Captures** – inline edit, `UPDATE_CAPTURE` message, storage update.
4. **Tab Badge Counts** – show per‑intent counts on tabs.

## 8. Phase 3 – Distribution (Chrome Web Store)
- Icon set, version bump, privacy policy, store listing assets, CSP audit.

## 9. Phase 4 – Sync / Backend (future)
- Remote DB, auth, cross‑device sync, sharing, mobile app.
- **Research mode:** Highlight text and export as markdown notes to a local Obsidian vault (metadata: title, URL, timestamp, intent).

## 10. Testing & Linting
- Manual smoke‑test (see ACTIVE TASK).
- `npx eslint src/` for style consistency.

## 11. Open Decisions / Open Questions
- Priority ordering of Phase 2 features (search vs. export).
- UI/UX for edit flow (modal vs. inline).
- Future storage migration path if sync is added.

## 12. Quick Reference Commands
```bash
# Reload extension after changes
chrome://extensions → Reload
# Run lint
npx eslint src/
```

---

**How to use:** Keep this file as the single source of truth for brainstorming, design reviews, and sprint planning. Add new decisions or tasks under the appropriate sections as the project evolves.