# Intent Chrome Extension Architecture

## Overview
The Intent extension captures a piece of content, classifies it with an LLM, stores the result, and displays it in a popup UI. It follows Chrome Extension MV3 architecture: a **background service worker**, a **content script**, and a **popup UI**.

## Components
| Component | Responsibility | File |
|-----------|----------------|------|
| **Background Service Worker** | Handles all storage (`chrome.storage.local`), LLM classification (`llm.js`), and message routing between UI and content script. | `src/background.js` |
| **Content Script** | Executes on the active tab to read the current selection and send it to the background worker via messages. Also shows toasts for save progress. | `src/content.js` |
| **Popup UI** | Renders saved captures, provides quick‑capture input, filter tabs, settings shortcut, and error banner. Interacts with the background worker via `chrome.runtime.sendMessage`. | `popup.html`, `src/popup.js`, `src/popup.css` |
| **LLM Adapter** | Abstracts Anthropic and LM Studio back‑ends, provides `classify`, `loadSettings`, `saveSettings`. Handles retries and fallback to `other` intent. | `src/llm.js` |
| **Settings UI** | Simple HTML page allowing the user to configure provider, API key, and model. | `settings.html`, `src/settings.js` |

## Data Flow
1. **User triggers capture** – via shortcut (`chrome.commands`) or quick‑input button.
2. **Content script** (or popup) collects `text`, `url`, `pageTitle` and sends `SAVE_SELECTION` to the background.
3. **Background** loads settings, calls `llm.classify` → receives `{intent, title, reason, extract}`.
4. Background builds a capture object, stores it in `chrome.storage.local` under `captures`.
5. Background sends a success message; the popup updates its in‑memory `allCaptures` array and re‑renders.
6. UI elements (tabs, delete button, card click) manipulate the stored captures via `GET_CAPTURES`, `DELETE_CAPTURE`, etc.

## Storage
- **Captures** – `chrome.storage.local['captures']` (array, newest first). May grow; UI filters client‑side.
- **Settings** – `chrome.storage.sync['intentSettings']` (provider, API key, model). Sync storage used for easy cross‑device sync in future phases.

## Extensibility (Phase 2 – Hybrid UI)
A hybrid UI approach keeps core logic in `src/popup.js` while optional feature modules live in `src/ui/`. New modules (search, export, edit) expose a simple `init()` that hooks into the existing state (`allCaptures`, `render`). This keeps the MVP stable and allows incremental additions without rewriting the main UI.

## Runtime Permissions
- `storage` (local & sync)
- `activeTab` (to read URL/title for shortcuts)
- `scripting` (inject selection script)
- `commands` (keyboard shortcut registration)

## Security Considerations
- LLM calls are performed in the background worker; no network requests from the UI.
- API keys are stored only in `chrome.storage.sync` and never logged.
- All messages are validated; unknown message types return an error.

## Future Directions
- Phase 3: Packaging for Chrome Web Store (icons, CSP audit).
- Phase 4: Remote sync via backend, authentication, cross‑device sharing.
