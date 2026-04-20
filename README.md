# Intent

A Chrome extension that captures **why** something mattered, not just what you saved.

Highlight text on any page, press a shortcut, and Intent classifies it (book, article, idea, quote, …) and records your reason — powered by a local or cloud LLM.

---

## Features

- **Shortcut capture** — select text, press `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac)
- **Quick capture** — type a thought directly in the popup
- **Page link toggle** — optionally attach the current URL to any capture
- **Intent classification** — LLM auto-tags each capture with an intent and reason
- **Filter tabs** — browse by intent category with live counts
- **Search** — full-text filter across titles, reasons, and raw text
- **Export** — download all captures as JSON or Markdown
- Stores everything locally in `chrome.storage.local` — no account, no server

---

## Prerequisites

| Tool | Version |
|------|---------|
| Chrome | ≥ 119 (MV3) |
| Node.js | ≥ 18 (for linting only) |
| LM Studio | any recent release (optional) |

---

## Quick start

1. Clone or download this repo
2. Open `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** → select this project folder
5. Open the extension popup and click ⚙ to configure your LLM backend

---

## Configuration

Open the Settings page (⚙ in the popup header).

| Setting | Options | Notes |
|---------|---------|-------|
| Provider | `Anthropic` / `LM Studio` | Switches the LLM backend |
| Anthropic API key | your key | Required when using Anthropic |
| LM Studio base URL | `http://localhost:1234/v1` | Must have CORS enabled; load a model first |
| Model | `claude-sonnet-4-6` (default) | Any Anthropic model ID, or the LM Studio model name |

Settings are stored in `chrome.storage.sync`.

---

## Project structure

```
intent/
├── popup.html          # Main popup UI
├── settings.html       # Settings page
├── manifest.json
├── icons/
└── src/
    ├── popup.js        # Popup state, render, quick capture, export
    ├── popup.css
    ├── settings.js     # Provider toggle, API key, test connection
    ├── settings.css
    ├── background.js   # Service worker — message routing, storage CRUD, shortcut
    ├── content.js      # Selection detection, toast system
    └── llm.js          # LLM adapter (Anthropic + LM Studio)
```

---

## Development

No build step. Edit files and reload the extension.

```bash
# Lint
npx eslint src/

# Reload after changes
# chrome://extensions → click the reload icon on the Intent card
```

To debug the background service worker: click **Inspect views: service worker** on the extension card.

---

## Deployment

1. Bump `version` in `manifest.json`
2. Zip the project folder (exclude `.git`, `node_modules`)
3. Upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
