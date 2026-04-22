# Chrome Web Store — Intent Listing Copy

---

## Short Description (≤ 132 characters)

> Save why something mattered, not just what you found. AI-powered capture with instant intent classification.

*(112 characters)*

---

## Long Description (≤ 16,000 characters — paste into "Detailed description" field)

**Intent — Your Digital Sanctuary for Captured Thoughts**

Every other tool saves content. Intent saves *why it mattered*.

You're reading an article and come across a book recommendation. You bookmark it — and never see it again. You take a screenshot — it disappears into your camera roll. Intent fixes this. One keyboard shortcut, and you have a permanent, classified record of *why* you saved something, not just *what* it was.

---

**How It Works**

Highlight any text on a webpage and press Ctrl+Shift+S (or Cmd+Shift+S on Mac). Intent reads your selection, sends it to an AI model, and within seconds you have a card in your personal feed with:

- A clean, extracted title
- A one-line reason why it was worth saving
- An automatic intent category (Book, Movie, Article, Idea, Quote, Product, or Recipe)

No text selected? Press the shortcut anyway — Intent saves the page title and URL as an article capture. You can also type raw thoughts directly in the popup without being on any particular page.

---

**Features**

◆ **AI Classification** — Automatically identifies what you saved and why, across 8 intent categories
◆ **Keyboard Shortcut** — Ctrl+Shift+S captures anything without breaking your reading flow
◆ **Instant Popup Feed** — Browse all saves filtered by intent type (Books, Movies, Ideas, etc.)
◆ **Search** — Filter by keyword across titles, reasons, and extracted text
◆ **Export** — Download your captures as JSON or Markdown
◆ **Supabase Sync** — Optional cross-device sync using your own Supabase project (zero data leaves your control)
◆ **Companion Web App** — Reflect on your captures in a full editorial-style dashboard at any screen size
◆ **Obsidian Export** — Export captures as Obsidian-compatible Markdown with YAML frontmatter, tags, and AI distillation bullets
◆ **AI Distillation** — Long articles distilled into 3 essential bullet points, cached after first view
◆ **Privacy First** — All data stored locally in your browser. No accounts. No telemetry. No servers you don't own.

---

**LLM Providers Supported**

Intent works with two AI backends — you configure whichever suits your setup:

- **Anthropic (claude-sonnet-4-6)** — Highest accuracy. Recommended for everyday use. Requires an Anthropic API key.
- **LM Studio (local)** — Run any GGUF model on your own machine. Free, offline, zero latency. Great for development.

---

**Privacy**

Intent never sends your data to the extension developer. Captures are stored in chrome.storage.local on your device. If you enable Supabase sync, data goes only to *your own* Supabase project using credentials *you* provide. Full privacy policy: [linked in extension settings].

---

**Getting Started**

1. Install the extension
2. Open the Settings page (⚙ icon or chrome://extensions → Options)
3. Select your LLM provider and enter your API key
4. Press Ctrl+Shift+S on any page to capture your first save
5. Click the extension icon to see your feed

---

*Intent is an open-source personal tool. For issues or feedback: github.com/ChinmayDharmik/intent*

---

## Category

**Productivity**

---

## Screenshots — What to Capture (1280×800 each, PNG)

Capture these 5 screens in order. Each has a caption suggestion for the store listing.

| # | Screen | Caption |
|---|--------|---------|
| 1 | Extension popup showing 3–4 cards across Book, Movie, and Idea tabs with the filter tabs visible | "Saves organised by intent — books, movies, ideas, quotes and more" |
| 2 | Success toast notification after a capture, showing classified intent + reason on the page | "One shortcut. AI reads your selection and tells you why it mattered." |
| 3 | Popup with the search bar active, filtering results | "Search across everything you've ever saved" |
| 4 | Web companion app showing the asymmetric grid with several filled cards | "Reflect on your library in the full companion web app" |
| 5 | Web app detail view showing a capture's distillation bullets + source link | "AI distillation: the essence of long articles in three bullets" |

**How to take them:**
- Set Chrome window to exactly 1280×800 (DevTools → device toolbar → custom size, then screenshot)
- Or use: chrome://extensions → extension popup → right-click inspect → device toolbar → 400×600 for popup screenshots
- The web app screenshots: open at 1280×800 in a normal browser window, use Chrome's built-in screenshot (DevTools → Cmd+Shift+P → "Capture screenshot")

---

## Promo Tile

File: `store/promo-tile.svg` — export to PNG at 440×280 before uploading.

**To export:**
- Open `promo-tile.svg` in a browser → right-click → "Save as image", or
- Use Inkscape / Figma import, or
- Run: `npx sharp-cli -i store/promo-tile.svg -o store/promo-tile.png --width 440 --height 280`

---

## Store Metadata

| Field | Value |
|-------|-------|
| Name | Intent |
| Summary (short desc) | Save why something mattered, not just what you found. AI-powered capture with instant intent classification. |
| Category | Productivity |
| Language | English |
| Privacy Policy URL | Host `privacy-policy.html` at a public URL (GitHub Pages recommended) |
| Homepage URL | https://github.com/ChinmayDharmik/intent *(or your preferred URL)* |
| Support URL | https://github.com/ChinmayDharmik/intent/issues |
