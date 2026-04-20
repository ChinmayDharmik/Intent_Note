---
name: chrome-extension
description: >
  Activate when working on Chrome Extension MV3 specifics: service worker lifecycle,
  content script <-> background messaging, chrome.storage patterns, manifest changes,
  or CSP issues. Do NOT activate for general JavaScript logic or UI work.
allowed-tools: Read, Edit, Bash, Glob
---

# Chrome Extension MV3

## Constraints
- Service workers are stateless between invocations — never rely on in-memory globals persisting across calls.
- Content scripts cannot import ES modules directly — they run in page context with no `import`. Use `chrome.runtime.sendMessage` for all communication with background.
- CSP for extension pages (`extension_pages`) is separate from page CSP. Only `connect-src` matters for fetch calls in background/popup.
- `chrome.storage.local` is async (Promise-based in MV3). Always `await` reads/writes.
- `activeTab` permission only grants tab access after a user gesture (click or shortcut). Do not assume tab access in background on startup.

## Core patterns

### 1. Background ↔ Content Script message round-trip
```js
// content.js — send and await response
const response = await chrome.runtime.sendMessage({
  type: 'SAVE_SELECTION',
  payload: { text, url, pageTitle }
});
// response = { ok: true, capture } or { ok: false, error }

// background.js — register listener, return response
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'SAVE_SELECTION') {
    handleSaveSelection(msg.payload).then(sendResponse);
    return true; // keep channel open for async response
  }
});
```

### 2. chrome.storage.local CRUD
```js
// Write
await chrome.storage.local.set({ captures: updatedArray });

// Read
const { captures = [] } = await chrome.storage.local.get('captures');

// Delete one item by id
const { captures = [] } = await chrome.storage.local.get('captures');
const updated = captures.filter(c => c.id !== targetId);
await chrome.storage.local.set({ captures: updated });
```

### 3. Keyboard shortcut → content script (MV3)
```js
// background.js — commands fire in background, not content script
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-selection') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // Inject a one-shot script to read selection
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ text: window.getSelection().toString(), url: location.href, pageTitle: document.title })
    });
    if (!result.text.trim()) {
      // notify content script to show "select text first" toast
      chrome.tabs.sendMessage(tab.id, { type: 'TOAST', text: 'Select some text first', status: 'error' });
      return;
    }
    // proceed to classify + save
  }
});
```

### 4. Toast injection from content script
```js
// content.js
function showToast(text, status = 'success') {
  const existing = document.getElementById('intent-toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'intent-toast';
  el.textContent = text;
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:2147483647;
    background:${status === 'error' ? '#dc2626' : '#18181b'};
    color:#fff; padding:10px 16px; border-radius:8px;
    font:500 14px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,.3);
    transition:opacity .3s;
  `;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3000);
}
```

### 5. Settings read in background/popup
```js
// Unified settings read — works in background and popup
async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return {
    provider: settings.provider ?? 'lmstudio',  // 'lmstudio' | 'anthropic'
    apiKey: settings.apiKey ?? '',
    lmStudioUrl: settings.lmStudioUrl ?? 'http://localhost:1234/v1',
  };
}
```

## Common failure modes

**1. `return true` missing in onMessage listener**
Symptom: `sendResponse` is called but popup/content script receives `undefined`.
Fix: Every async `onMessage` handler must `return true` synchronously to keep the message channel open.

**2. Service worker goes dormant mid-fetch**
Symptom: Long API calls (>30s) get interrupted; storage write never happens.
Fix: Keep API calls under 30s (the `max_tokens: 300` budget helps). For safety, wrap critical work in `chrome.storage` writes before any await that could be slow.

**3. CSP blocks fetch to localhost or Anthropic**
Symptom: `Refused to connect` error in background DevTools console.
Fix: Ensure `connect-src` in `content_security_policy.extension_pages` includes the target origin. `host_permissions` alone is not enough for CSP.

**4. Content script not injected on extension install**
Symptom: Shortcut does nothing on tabs that were open before the extension was installed.
Fix: Use `chrome.scripting.executeScript` from background (triggered by the command) as a fallback, or ask user to reload the tab.

**5. `chrome.scripting.executeScript` requires `scripting` permission**
Symptom: `TypeError: Cannot read properties of undefined (reading 'executeScript')`.
Fix: Confirm `"scripting"` is in `permissions` in manifest.json. It is in this project — verify it wasn't accidentally removed.

## Protocol

**Adding a new message type (background ↔ content/popup):**
1. Define the message shape as a comment at the top of `background.js`: `// { type: 'MY_TYPE', payload: {...} } → { ok: bool, ... }`
2. Add a branch in `chrome.runtime.onMessage.addListener` in `background.js`. Return `true`.
3. Add the `sendMessage` call in the caller (content.js or popup.js).
4. Test: open background worker DevTools (chrome://extensions → Inspect service worker), trigger the action, check console for errors.
5. Verify the response object is what the caller expects before moving on.
