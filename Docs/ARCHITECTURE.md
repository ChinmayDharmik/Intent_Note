# Architecture

## Overview

Intent is a **dual-platform system**: a Chrome Extension that does capture, and a web application that does reflection. They share data through an optional Supabase backend. Either half works standalone.

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│  Chrome Extension           │        │  Web App (/web)              │
│  (Capture Layer)            │        │  (Reflection Layer)          │
│                             │        │                              │
│  popup.html  settings.html  │        │  Vite + vanilla JS           │
│       ▲            ▲        │        │  Asymmetric feed + detail    │
│       │            │        │        │                              │
│  ┌─────────────────────┐    │        │  ┌────────────────────────┐  │
│  │ background.js (SW)  │    │        │  │ main.js / render.js    │  │
│  │  - shortcut handler │    │        │  │  - feed grid           │  │
│  │  - classify()       │    │        │  │  - lazy distillation   │  │
│  │  - storage CRUD     │    │        │  │  - edit mode           │  │
│  │  - Supabase sync    │    │        │  └────────────────────────┘  │
│  └─────────────────────┘    │        │           │                  │
│       │          │          │        │           │                  │
│       ▼          ▼          │        │           ▼                  │
│  ┌─────────┐  ┌────────┐    │        │     localStorage             │
│  │ content │  │ llm.js │    │        │     (keys + Supabase URL)    │
│  │  .js    │  │        │    │        │                              │
│  │ (toasts)│  │ 4 prov │    │        │                              │
│  └─────────┘  └────────┘    │        │                              │
│       │          │          │        │                              │
│       │          │          │        │                              │
└───────┼──────────┼──────────┘        └──────────────────────────────┘
        │          │                                   ▲
        │          ▼                                   │
        │      ┌──────────────┐                        │
        │      │ LLM Provider │                        │
        │      │ (4 adapters) │                        │
        │      └──────────────┘                        │
        ▼                                              │
  chrome.storage.local ──── async upsert ──► Supabase (Postgres + REST)
  (offline-first,                                      │
   source of truth)                                    │
                                                       └─ web app reads here
```

## Components

### Chrome Extension (Capture Layer)

**`background.js` — Service Worker**
The orchestrator. Every user action flows through here. Receives messages from popup / content / shortcut handler, loads settings, calls the LLM adapter, writes to `chrome.storage.local`, and fires an async upsert to Supabase if sync is configured. Never blocks the UI on network calls.

**`content.js` — Content Script**
Injected into every page. Pre-captures the current selection on every `selectionchange` event so the selection is never lost between keypress and service worker response. Also renders toast notifications (saving / success / error).

**`popup.js` — Popup UI**
Pure presentation. Sends messages to the background worker for every state change. Implements: feed rendering, filter tabs, search, tag cloud, inline edit mode, export, quick capture.

**`settings.js` — Settings page**
Provider toggle (Gemini Nano / Cloud / Anthropic / LM Studio), API key management, Supabase credentials, connection test.

**`llm.js` — LLM Adapter**
Single `classify()` function abstracts four providers. Returns a strict JSON envelope: `{intent, title, reason, extract, tags}`. Retries once on 5xx / network, throws immediately on 4xx (auth). Parses malformed responses defensively — strips markdown fences, extracts JSON from prose, validates intent against the 8-category enum.

### Web App (Reflection Layer)

**Vite + vanilla JS.** No framework overhead. The app reads captures from Supabase on load, renders them in an asymmetric editorial grid (varied card heights, offset margins), and opens a detail view on click. Detail view lazily triggers a distillation LLM call to produce 3 bullet summaries — cached back to Supabase so the second open is instant.

### Data Layer

**Primary store: `chrome.storage.local["captures"]`** — an array of capture objects. Always the source of truth. Offline-first: capture succeeds even with zero network.

**Settings: `chrome.storage.sync["intentSettings"]`** — provider, keys, Supabase URL. Uses the `sync` tier because it's tiny (<8KB) and nice to have cross-device.

**Sync target: Supabase Postgres** — optional. Table: `captures (id, intent, title, reason, extract, raw_text, url, page_title, saved_at, intent_meta jsonb, tags text[], distillation jsonb, deleted_at timestamptz)`. Soft-deletes only — `deleted_at` timestamp, no hard deletes, no data loss.

**Secrets: none committed.** Keys live in `chrome.storage.sync` on the user's browser and `localStorage` in the web app. `.env.local` is gitignored.

## Capture flow (end-to-end)

```
1. User presses Ctrl+Shift+S (or types in popup)
2. content.js has already captured the selection via pre-capture listener
3. background.js receives SAVE_SELECTION
4. Loads settings, determines provider
5. Calls llm.js → classify(text, url, pageTitle)
6. LLM returns {intent, title, reason, extract, tags}
   ├─ On malformed JSON → fallback {intent: "other", ...raw}
   └─ On 5xx/network → retry once → then fallback
7. Assemble capture object, prepend to chrome.storage.local
8. Fire async Supabase upsert (non-blocking)
9. Send success message → popup refreshes, content.js shows toast
```

The capture never fails. At worst it's saved as `other` intent with the raw text, still recoverable.

## Provider strategy

Four providers, one adapter:

| Provider | Trigger | Use case |
|---|---|---|
| Gemini Nano | Default | Runs entirely on-device via Chrome's Built-in AI; zero cost, zero latency, zero data leaves the machine |
| Gemini Cloud | Nano unavailable fallback | Same vendor, similar output shape, costs per call |
| Anthropic | User override | Higher quality for ambiguous captures |
| LM Studio | User override | Fully local, user's own model |

The fallback chain (Nano → Cloud) is automatic in the adapter. The other two are explicit user choice.

## Why dual-platform

The capture moment and the reflection moment are different in kind.

**Capture** is fast, interruptive, happens on the page you're reading. A popup + keyboard shortcut is the right surface.

**Reflection** is slow, deliberate, deserves a full page. An editorial grid with room to breathe, a distraction-free detail view, lazy AI summaries — these don't fit in a 380px popup.

Building both into one surface would compromise both. Building only one means the tool fails at half the job.
