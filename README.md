# Intent

A Chrome extension that captures **why** something mattered, not just what you saved.

Highlight text on any page, press a shortcut, and Intent classifies it — book, article, idea, quote, and more — and records your reason. Powered by on-device AI, a local LLM, or a cloud API.

---

## Features

- **Shortcut capture** — select text, press `Ctrl+Shift+S` (`Cmd+Shift+S` on Mac)
- **Quick capture** — type a thought directly in the popup
- **Page link toggle** — optionally attach the current URL to any capture
- **Intent classification** — LLM auto-tags each capture (8 categories) with a title and reason
- **Auto-tags** — LLM suggests conceptual tags; add or remove them inline
- **Filter tabs** — browse by intent category with live counts
- **Tag cloud** — filter by any conceptual tag across your feed
- **Search** — full-text filter across titles, reasons, and raw text
- **Edit captures** — update title, reason, intent, or tags after saving; re-classify with one click
- **Export** — download all captures as JSON or Markdown
- **Sync** — optional Supabase sync so captures appear on the companion web dashboard
- Stores everything locally in `chrome.storage.local` — no account required

---

## Install (no store required)

Chrome extensions can be loaded directly from your file system in seconds.

### Step-by-step

1. **Download the extension**

   - **Git:** `git clone https://github.com/ChinmayDharmik/Intent_Note.git`
   - **ZIP:** click **Code → Download ZIP** on GitHub, then unzip it

2. **Open Chrome extensions page**

   Paste this into your address bar and press Enter:
   ```
   chrome://extensions
   ```

3. **Enable Developer mode**

   Toggle **Developer mode** on (top-right corner of the extensions page).

4. **Load the extension**

   Click **Load unpacked** → navigate to the downloaded/cloned folder → select it.

   The Intent icon (◆) will appear in your toolbar. Pin it for easy access.

5. **Configure your LLM backend**

   Click the ◆ icon → click ⚙ (Settings) → choose a provider and enter your key (see [Configuration](#configuration) below).

> **Updates:** When you pull new changes, go back to `chrome://extensions` and click the **↻ reload** icon on the Intent card.

---

## Configuration

Open Settings (⚙ in the popup header). Choose one provider:

| Provider | What it needs | Notes |
|----------|--------------|-------|
| **Gemini Nano** *(default)* | Nothing | Runs fully on-device. Requires Chrome 127+ with Built-in AI enabled. Falls back to Gemini Cloud if unavailable. |
| **Gemini Cloud** | Gemini API key (`AIza…`) | Get one free at [aistudio.google.com](https://aistudio.google.com) |
| **Anthropic** | Anthropic API key (`sk-ant-…`) | Get one at [console.anthropic.com](https://console.anthropic.com) |
| **LM Studio** | Running LM Studio instance | Set base URL (default `http://localhost:1234/v1`). Enable CORS in LM Studio → Local Server. |

All keys are stored locally in `chrome.storage.sync` — never sent anywhere except the chosen provider's API.

### Optional: Supabase sync

To sync captures to the companion web dashboard, add your Supabase project URL and anon key in the Sync section of Settings. Leave blank to disable.

---

## Project structure

```
intent/
├── manifest.json
├── popup.html              # Extension popup
├── settings.html           # Settings page
├── privacy-policy.html
├── icons/
└── src/
    ├── background.js       # Service worker — routing, storage, Supabase sync
    ├── content.js          # Toast notifications, selection script
    ├── llm.js              # LLM adapter (Gemini Nano / Cloud, Anthropic, LM Studio)
    ├── popup.js            # Popup UI — feed, filter, quick capture, tags, export
    ├── popup.css
    ├── settings.js         # Settings UI — provider toggle, keys, sync
    ├── settings.css
    ├── fonts.css           # Local @font-face declarations
    └── fonts/              # Bundled Manrope + Noto Serif (no CDN)
        ├── manrope-*.ttf
        └── noto-serif-*.ttf
```

### Companion web app (`/web`)

A Vite + vanilla JS dashboard that reads captures from Supabase. Runs as a local Electron desktop app — no hosting required.

```
web/
├── electron.cjs        # Electron main process
├── vite.config.js
├── package.json
└── src/
    ├── main.js         # App bootstrap, settings, nav
    ├── supabase.js     # Supabase client (reads credentials from settings)
    ├── llm.js          # LLM adapter + settings persistence (localStorage)
    ├── render.js       # Card, detail, settings panel builders
    ├── export.js       # JSON / Markdown / ZIP export
    └── style.css
```

**Run the desktop app:**

```bash
cd web
npm install
npm run electron       # build + open in a desktop window
```

**Package an installer:**

```bash
npm run dist           # outputs to web/release/
```

On first launch, click ⚙ (Settings) and enter your Supabase URL and anon key under **Sync**.

**Dev server (browser):**

```bash
npm run dev            # Vite dev server at http://localhost:5173
```

---

## Development

No build step for the extension. Edit files and reload.

```bash
# Lint
npx eslint src/

# Reload after changes
# chrome://extensions → click ↻ on the Intent card
```

**Debug the service worker:** on the extensions page, click **Inspect views: service worker** under the Intent card. All message routing and storage operations log here.

---

## Permissions

| Permission | Why |
|-----------|-----|
| `storage` | Save captures and settings locally |
| `activeTab` | Read the current tab's URL and title on capture |
| `scripting` | Inject the selection-reading script when shortcut is pressed |
| `tabs` | Resolve the active tab for the page-link toggle |

Host permissions (`<all_urls>`, provider API domains, Supabase) are needed only for the LLM classify call and optional sync — no browsing data is collected.
