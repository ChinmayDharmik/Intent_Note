# Intent — Product Requirements Document

### Version 1.1 | Chrome Extension | Damco Tech Round Submission

*Revised 2026-04-18 — implementation corrections and storage contract clarifications*

---

## 1. Problem Statement

While surfing the internet — researching, consuming content, reading articles — people constantly encounter ideas, recommendations, and things worth remembering. The current behaviour is fragmented: screenshots on the phone, browser bookmarks, random notes, saved tabs. None of these tools understand *why* something was saved.

The result: a graveyard of captured content that never gets acted on. The friction of going back exceeds the value of what was saved.

**Core insight:** Every other tool saves content. Intent saves *why it mattered.*

---

## 2. Product Vision

A Chrome extension that sits invisibly in the browser, understands what you're saving at the moment you save it, and makes retrieval effortless — without requiring the user to organise, tag, or categorise anything.

**One-liner:** Your browser finally remembers what you meant to do.

---

## 3. Goals

| **Goal**           | **Metric**                 | **Rationale**                                                       |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------- |
| Zero friction on capture | Capture completed in < 2 seconds | Minimizes cognitive load during research.                                 |
| Classification accuracy  | Correct intent inferred > 85%    | Validated via "Golden Dataset" of 30 hand-labeled test cases.             |
| System Resilience        | **Zero lost captures**     | Every interaction must result in a saved item, regardless of LLM failure. |
| Local-First Privacy      | 100% local capture storage       | Ensures user privacy and zero-latency retrieval without a backend.        |

---

## 4. Non-Goals (MVP)

- No sync across devices
- No sharing or collaboration
- No search functionality
- No export
- No mobile app
- No account or login
- No editing of saved captures

*These are non-goals for v1.0 only. See Section 14 for the post-MVP roadmap.*

---

## 5. User Personas

**Primary: The Curious Browser**
Spends significant time reading articles, watching content, and researching. Regularly encounters things worth remembering. Currently uses a mix of bookmarks, screenshots, and notes apps — none of which they return to consistently.

**Secondary: The Passive Learner**
Consumes content but does not have a note-taking habit. Would benefit from capture if it required zero effort. The current tools are too high-friction to adopt.

---

## 6. User Stories

### Capture

> **US-01** As a user, I want to highlight text on any webpage and save it with a single keyboard shortcut, so that I don't break my reading flow.

> **US-02** As a user, I want to press the keyboard shortcut on any page without selecting text, and have the page itself saved by intent, so that I can save an entire page's context without selecting anything.

> **US-03** As a user, I want to open the extension and type a raw thought or idea, so that I can capture things that aren't on a webpage.

> **US-04** As a user, I want to see a brief toast notification confirming what was saved and how it was classified, so that I know the system understood my intent.

### Classification

> **US-05** As a user, I want the system to automatically determine whether I saved a book recommendation, movie, article, idea, quote, product, or recipe — without me selecting a category.

> **US-06** As a user, I want each saved item to have a one-line explanation of why it was saved, so that context is preserved even weeks later.

> **US-07** As a user, I want the title of each saved item to be extracted or inferred automatically, so that I never have to name anything.

### Retrieval

> **US-08** As a user, I want to open the extension and see my saves grouped by intent type (books, movies, ideas, etc.), so that I can browse by what I'm in the mood for.

> **US-09** As a user, I want to click a saved item and go directly to the original source URL, so that I can act on it immediately.

> **US-10** As a user, I want to delete items I've acted on or no longer need, so that my list stays relevant.

> **US-11** As a user, I want to see the most recently saved items first, so that recent captures are easy to find.

---

## 7. Intent Classification Schema

| Intent      | Trigger Signals                                   | Emoji | Example                               |
| ----------- | ------------------------------------------------- | ----- | ------------------------------------- |
| `book`    | Book title, author, "worth reading", ISBN         | 📚    | "Thinking, Fast and Slow by Kahneman" |
| `movie`   | Film title, director, streaming platform, "watch" | 🎬    | "Oppenheimer on Netflix"              |
| `article` | News, blog, essay, "read later"                   | 📰    | Article saved from Medium             |
| `idea`    | Concept, framework, insight, "think about"        | 💡    | "Mental model for decision making"    |
| `quote`   | Memorable sentence, attributed phrase             | 💬    | "The map is not the territory"        |
| `product` | App, tool, software, physical product             | 🛍️  | "Raycast productivity app"            |
| `recipe`  | Food, ingredients, cooking, dish name             | 🍳    | "One-pot pasta recipe"                |
| `other`   | Anything that does not match above                | 📌    | —                                    |

---

## 8. Architecture

### 8.0 LLM Backend Strategy

| Mode              | Provider  | Base URL                         | Auth    | Use Case                  |
| ----------------- | --------- | -------------------------------- | ------- | ------------------------- |
| Development       | LM Studio | `http://localhost:1234/v1`     | None    | Local, free, zero latency |
| Production / Demo | Anthropic | `https://api.anthropic.com/v1` | API Key | Accuracy, reliability     |

Both are configurable in the extension's Settings panel. The API layer is abstracted so the same call works against either backend. LM Studio exposes an OpenAI-compatible REST API, so a single adapter handles both modes — only the base URL, auth header, and response parsing differ.

**Recommended dev model in LM Studio:** `mistral-7b-instruct` or `llama3-8b-instruct` — fast enough for real-time classification.

**Demo / production model:** `claude-sonnet-4-6` via Anthropic API.

---

### 8.1 High-Level Components

```
┌─────────────────────────────────────────────────────┐
│                  Chrome Extension                    │
│                                                      │
│  ┌──────────────┐   ┌──────────────┐                │
│  │ Content       │   │   Popup UI   │                │
│  │ Script        │   │              │                │
│  │               │   │ • View saves │                │
│  │ • Shows toast │   │ • Type idea  │                │
│  │   only        │   │ • Filter by  │                │
│  │               │   │   intent     │                │
│  └──────┬───────┘   └──────┬───────┘                │
│         │                  │                         │
│         └────────┬─────────┘                        │
│                  ▼                                   │
│         ┌────────────────┐                          │
│         │  Background    │                          │
│         │  Service       │                          │
│         │  Worker        │                          │
│         │                │                          │
│         │ • Reads        │                          │
│         │   selection    │                          │
│         │   via          │                          │
│         │   executeScript│                          │
│         │ • Orchestrates │                          │
│         │   LLM calls    │                          │
│         │ • Manages      │                          │
│         │   storage      │                          │
│         │ • Handles      │                          │
│         │   shortcuts    │                          │
│         └───────┬────────┘                          │
└─────────────────┼───────────────────────────────────┘
                  │
        ┌─────────▼──────────┐
        │  LLM Adapter       │
        │  (llm.js)          │
        │                    │
        │  Anthropic API or  │
        │  LM Studio —       │
        │  same interface    │
        │                    │
        │  Input:            │
        │  • Selected text   │
        │  • Page URL        │
        │  • Page title      │
        │                    │
        │  Output:           │
        │  • intent type     │
        │  • title           │
        │  • reason          │
        │  • extract         │
        └─────────┬──────────┘
                  │
      ┌───────────┴──────────┐
      │                      │
┌─────▼──────────┐   ┌───────▼──────────┐
│ chrome.storage  │   │ chrome.storage   │
│ .local          │   │ .sync            │
│                 │   │                  │
│ captures[]      │   │ intentSettings   │
│ • id            │   │ • provider       │
│ • intent        │   │ • anthropicApiKey│
│ • title         │   │ • lmstudioBaseUrl│
│ • reason        │   │ • lmstudioModel  │
│ • extract       │   └──────────────────┘
│ • rawText       │
│ • url           │
│ • pageTitle     │
│ • savedAt       │
│ • intentMeta    │
└─────────────────┘
```

## 9. Future Roadmap

### Phase 4 – Research Mode & Obsidian Integration

- **Research mode:** Users can highlight text, toggle research mode, and have selections exported as markdown notes to a local Obsidian vault folder. Notes include title, source URL, saved timestamp, and extracted intent metadata.
- **Integration:** Uses Chrome's file system API (future permission) to write directly to the user‑specified vault path.


---

### 8.2 Data Flow — Capture (keyboard shortcut)

```
Keyboard shortcut fires (Ctrl+Shift+S / Cmd+Shift+S)
        │
        ▼
commands.onCommand fires in Background Service Worker
        │
        ▼
chrome.scripting.executeScript reads from active tab:
  { text: window.getSelection(), url, pageTitle }
        │
        ▼
If text is empty → use "${pageTitle} — ${url}" as fallback
(page intent capture, classified as article)
        │
        ▼
Background calls handleSave(payload)
        │
        ├─ Sends SAVING message → content script shows spinner toast
        │
        ├─ loadSettings() from chrome.storage.sync["intentSettings"]
        │
        └─ classify(text, url, pageTitle, settings) via llm.js
                │
                ▼
           LLM returns JSON: { intent, title, reason, extract }
                │
                ▼
           Background builds capture object + saves to chrome.storage.local
                │
                ▼
           Sends SAVE_CONFIRMED → content script shows success toast:
           "📚 Thinking, Fast and Slow — Recommended as essential reading"
```

---

### 8.3 Data Flow — Retrieval

```
User opens extension popup
        │
        ▼
Popup sends GET_CAPTURES to Background
        │
        ▼
Background reads chrome.storage.local["captures"]
        │
        ▼
Returns captures[] sorted by savedAt DESC (newest first)
        │
        ▼
Popup renders cards, filtered by active tab (All / 📚 / 🎬 / etc.)
        │
        ▼
User clicks card → opens original URL in new tab
User clicks ✕   → DELETE_CAPTURE → storage update → re-render
```

---

### 8.4 Capture Object Schema

```json
{
  "id": "1718123456789-ab3cd",
  "intent": "book",
  "title": "Thinking, Fast and Slow",
  "reason": "Recommended as essential reading for decision-making",
  "extract": "Kahneman distinguishes System 1 and System 2 thinking",
  "rawText": "original highlighted text (max 300 chars)",
  "url": "https://example.com/article",
  "pageTitle": "10 Books That Changed My Thinking",
  "savedAt": "2025-04-17T09:23:11.000Z",
  "intentMeta": {
    "label": "Book",
    "emoji": "📚",
    "color": "#E8D5B7"
  }
}
```

*Note: `id` is `${Date.now()}-${5-char random alphanumeric}` — collision-safe for single-user local storage.*

---

### 8.5 Storage Contract

| Data           | Storage type             | Key                  | Written by                 | Read by                                       |
| -------------- | ------------------------ | -------------------- | -------------------------- | --------------------------------------------- |
| Captures array | `chrome.storage.local` | `"captures"`       | `background.js`          | `background.js`, `popup.js` (via message) |
| User settings  | `chrome.storage.sync`  | `"intentSettings"` | `settings.js` (directly) | `llm.js` via `loadSettings()`             |

**Rationale for split:**

- `local` for captures: 10MB quota; captures grow over time. No cross-device sync needed (PRD non-goal).
- `sync` for settings: API key and provider choice should follow the user if they reinstall. Small object, well within 8KB sync quota.

---

### 8.6 Component Responsibilities

| Component         | File                                    | Responsibility                                                                                                   |
| ----------------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Manifest          | `manifest.json`                       | Permissions, CSP, entry points, keyboard shortcut registration                                                   |
| Background Worker | `src/background.js`                   | Message bus, storage CRUD, shortcut handler, selection extraction via `executeScript`, toast dispatch          |
| LLM Adapter       | `src/llm.js`                          | `classify()`, `loadSettings()`, `saveSettings()` — abstracts Anthropic and LM Studio behind one interface |
| Content Script    | `src/content.js`                      | Toast notifications only. Does not read selections or touch storage.                                             |
| Popup UI          | `popup.html` + `src/popup.js`       | Feed rendering, filter tabs, quick capture input, delete, settings error banner                                  |
| Settings UI       | `settings.html` + `src/settings.js` | Provider toggle, API key input, LM Studio URL, test connection. Writes directly to `chrome.storage.sync`.      |
| Styles            | `src/popup.css`, `src/settings.css` | Extension UI styling                                                                                             |



### 8.7 Engineering Rigor & Reliability

* **Prompt Validation:** The system prompt was iterated against a "Golden Dataset" of diverse web snippets to ensure reliable classification across different models.
* **Failure Resilience:** The architecture explicitly handles malformed JSON or API timeouts. If the LLM returns invalid data, the system preserves the raw text and categorizes it as `other` so no user data is lost.
* **Perceived Latency (UX):** A shimmer overlay and loading state are implemented during the inference window (1–2 seconds). This provides immediate visual feedback while the background worker awaits the LLM response.

### 8.8 Architectural Rationale (The "Why")

* **Storage Tiering:** `chrome.storage.local` is used for captures to leverage the 10MB quota. `chrome.storage.sync` is reserved for settings (API keys, provider choice) to stay within the 8KB limit while ensuring settings persist across devices.
* **`executeScript` vs. Content Scripts:** Selection extraction is performed via `chrome.scripting.executeScript`. This is more robust than long-lived content scripts, which can become orphaned during extension updates or background worker suspensions in Manifest V3.
* **Provider Abstraction:** The `llm.js` adapter provides a unified interface. The extension can switch between LM Studio (local dev) and Anthropic (production) with zero changes to the core business logic.

---

## 9. Classification Prompt Design

The LLM prompt is the core intelligence of the system. Key design decisions:

**Context provided:** Selected text (max 300 chars) + page URL + page title. The URL and title carry significant signal (e.g., a URL containing "recipes" is strong evidence even if the selected text is ambiguous).

**Output format:** Strict JSON. No markdown fences. No explanation text. Enables reliable parsing without post-processing.

**Prompt output shape:**

```json
{
  "intent": "<one of 8 types>",
  "title": "<extracted or inferred title, ≤ 60 chars>",
  "reason": "<one sentence: why this was worth saving>",
  "extract": "<key fact or quote from the text, ≤ 100 chars>"
}
```

**Token budget:** `max_tokens: 300`. Classification is a narrow task; the output shape is ~150 chars. A large budget wastes latency and cost.

**Parse failure handling:** Strip accidental markdown fences, attempt `JSON.parse`. If parsing still fails, save with `intent: "other"` and raw text preserved. No capture is ever silently lost.

---

## 10. Tradeoffs

| Decision              | Chosen                                                            | Alternative                                            | Reason                                                                                          |
| --------------------- | ----------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Captures storage      | `chrome.storage.local`                                          | Remote database                                        | No account needed, zero latency, privacy-first                                                  |
| Settings storage      | `chrome.storage.sync`                                           | Also `local`                                         | Settings are small; sync means reinstall preserves API key                                      |
| Classification        | LLM API call                                                      | Rule-based regex                                       | LLM handles ambiguity and infers context; regex fails on edge cases                             |
| Capture trigger       | Keyboard shortcut (reads selection via `executeScript`)         | Content script reads selection and messages background | MV3 service workers can't guarantee content script is loaded;`executeScript` is more reliable |
| No-selection fallback | Save page as article (`${pageTitle} — ${url}`)                 | Toast "Select text first" and do nothing               | Preserves user intent for whole-page saves; every shortcut press produces a capture             |
| Dev LLM               | LM Studio (local)                                                 | Cloud API during dev                                   | Free, offline, instant iteration — switch to Anthropic for demo                                |
| API abstraction       | Single `classify()` in `llm.js`, provider is a settings value | Two separate code paths                                | One prompt, one interface; backend switch requires no code change                               |
| Demo model            | `claude-sonnet-4-6` via Anthropic                               | Local model for demo                                   | Accuracy on ambiguous text justifies cloud call for final demo                                  |

---

## 11. Failure Modes

| Failure                              | Behaviour                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| API call fails (network / 5xx)       | One automatic retry. On second failure: toast "Could not save — check connection". Item not stored. |
| API returns 401 / 403                | Immediate throw — no retry. Toast: "API key error — check extension settings".                     |
| API returns malformed JSON           | Item saved as intent `other`, raw text preserved.                                                  |
| No text selected when shortcut fires | Page title + URL used as capture text. Classified normally. No error shown.                          |
| LM Studio not running                | `fetch` throws `ERR_CONNECTION_REFUSED`. Treated as network error (one retry, then toast).       |
| Storage quota exceeded               | `chrome.storage.set` throws. Toast: "Storage full — delete some items to continue".               |

---

## 12. Build Plan

| Day   | Tasks                                                                                                                                                                       | Status                                                         |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Day 1 | Extension scaffold, manifest, background worker, content script, popup + settings UI structure                                                                              | **Complete** (all files exist; `llm.js` needs rewrite) |
| Day 2 | Write `llm.js` (LLM adapter, `classify`, `loadSettings`, `saveSettings`). Fix self-message bug in background. Fix model ID in settings test. Smoke test end-to-end. | **In progress**                                          |
| Day 3 | Edge case handling, demo flow polish, video recording                                                                                                                       | Not started                                                    |

**Remaining work before demo:**

1. Rewrite `llm.js` — currently contains wrong content (copy of `background.js`). This is the only functional blocker.
2. Fix `background.js:172` — replace self-`sendMessage` with direct `handleSave(payload, () => {})`.
3. Fix `settings.js:142` — model ID `claude-sonnet-4-20250514` → `claude-sonnet-4-6`.

---

## 13. Demo Script (Video Outline)

**Problem framing (2 min)**
Show a real screenshot graveyard. Open bookmarks. Show the chaos. Articulate: tools save content, not intent.

**Live demo (3 min)**

- Highlight a book mention in an article → shortcut → spinner toast → success toast → sidebar shows 📚 Book card with extracted title and reason
- Press shortcut on a movie review page without selecting text → sidebar shows 🎬 Movie card (whole-page capture)
- Type a raw idea in the popup input → sidebar shows 💡 Idea card
- Show all three in the sidebar, each in the right bucket, with filter tabs working

**Architecture walkthrough (3 min)**
Background worker reads selection via `executeScript` → `llm.js` adapter → Anthropic API → `chrome.storage.local` → Popup re-renders

**Tradeoffs (1 min)**
Local storage vs remote. LLM vs rule-based. `executeScript` vs content script for selection reading.

**Failure modes + what's missing (1 min)**
No search. No cross-device sync. Classification degrades on very short or ambiguous text.

---

---

## 14. Post-MVP Roadmap

### Phase 2 — Quality of Life (no backend required)

Phase 2 will adopt a hybrid UI approach: core capture logic remains in `popup.js` while new features (search, export, edit, badge counts) are implemented as lightweight ES modules (`ui/*.js`). This keeps the extension build‑step‑free and maintains the existing stack (vanilla JS, `chrome.storage.local`).

| ID    | Feature                                                                                                                                               | Complexity | Value                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------- |
| P2-01 | **Search / text filter** — in-memory filter on `allCaptures` (title + reason + rawText), keyup input above the tabs bar. No storage changes. | Low        | High — feed becomes unusable at 50+ captures without it |
| P2-02 | **Export** — serialize `chrome.storage.local` → JSON blob → `URL.createObjectURL` download. Markdown variant optional. No new APIs.      | Low        | Medium — data portability builds user trust             |
| P2-03 | **Edit captures** — inline edit form on card; `UPDATE_CAPTURE` message type in `background.js`; update array in storage.                   | Medium     | Medium — corrects LLM misclassifications                |
| P2-04 | **Count badges on tabs** — compute per-intent counts from `allCaptures` during render; append count to tab label.                            | Trivial    | Low — UX polish only                                    |

**Recommended order:** P2-01 → P2-02 → P2-03 → P2-04

---

### Phase 3 — Chrome Web Store Distribution

| Item             | Notes                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Icon sizes       | Confirm 128×128, 48×48, 16×16 all present in `/icons/`                                                                                                             |
| Version bump     | Increment `manifest.json` version field                                                                                                                               |
| Privacy policy   | Required — extension stores page content. A single static HTML page is sufficient.                                                                                     |
| Store listing    | Title, short description, screenshots, 440×280 promo tile                                                                                                              |
| Google Fonts CSP | CDN font links in `popup.html` / `settings.html` may require justification during review. Alternative: bundle fonts locally (~50KB, removes CSP question entirely). |

---

### Phase 4 — Sync and Backend (significant complexity jump)

These features require a remote database and authentication. They are out of scope until Phase 2 and 3 are complete and the extension is published.

| Feature             | Blocker                                                      | What It Needs      |
| ------------------- | ------------------------------------------------------------ | ------------------ |
| Sync across devices | `chrome.storage.sync` quota is 8KB — cannot hold captures | Remote DB + auth   |
| Share captures      | Requires public URLs, access control                         | Backend API        |
| Mobile app          | No Chrome, different capture model                           | React Native / PWA |



### Phase 5 — Advanced Technical Evolutions

These features focus on cutting-edge browser capabilities and AI optimization.

* **On-Device Inference (Gemini Nano):** Integration with the `window.ai` API. This removes external API costs and network latency while keeping data 100% private.
* **Semantic "Mood" Browsing:** Implementing a WASM-based vector engine (like Orama). This allows for conceptual retrieval (e.g., "things that make me feel productive") rather than just category filtering.
* **Prompt Caching:** Implementing caching headers for the Anthropic API. This reduces latency and token costs for users with repetitive capture patterns.

---

*Document prepared for Damco Group — Evolve by Damco AI Engineer Tech Round*
