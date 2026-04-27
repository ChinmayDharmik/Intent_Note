# Failure Modes and System Resilience

Every component was designed assuming something will go wrong. This document maps the failure modes I anticipated and what the system does about each one.

---

## 1. Network is down at capture time

**Failure:** User presses Ctrl+Shift+S with no internet connection.

**What happens:** `chrome.storage.local` write succeeds. The Supabase upsert is a fire-and-forget `fetch()` call that fails silently. A red sync-status dot appears in the popup header.

**Data outcome:** Capture is never lost. The local store is the source of truth. If Supabase sync is configured, the capture will re-sync on the next successful save (the upsert uses the capture's UUID as primary key, so there is no duplication risk).

**Cost of this design:** Supabase can drift behind local state. Acceptable for a single-user tool — I'm not racing another session.

---

## 2. LLM returns malformed JSON

**Failure:** The language model returns prose, partial JSON, or wraps valid JSON in markdown fences.

**What happens:** `llm.js` runs a three-stage defensive parser:
1. Strip ` ```json ` / ` ``` ` fences
2. Extract the first `{...}` block via regex
3. Validate `intent` against the 8-category enum

If all three stages fail, the adapter constructs a fallback object:
```js
{ intent: "other", title: pageTitle, reason: "", extract: rawText, tags: [] }
```

**Data outcome:** The capture saves with intent `"other"` and the raw text intact. Nothing is lost. The user can re-classify manually via the Re-classify button.

**Cost:** An `"other"` capture is noisier than a classified one. The re-classify path exists precisely to recover from this.

---

## 3. LLM API is unreachable or returns 5xx

**Failure:** Anthropic, Gemini Cloud, or LM Studio returns a 5xx error or times out.

**What happens:** `llm.js` retries once after a short delay. If the retry also fails, it falls through to the malformed-JSON fallback path described above.

**4xx errors (auth):** These are thrown immediately — no retry. A 401/403 means the key is wrong; retrying won't help.

**Data outcome:** Same as malformed JSON — capture saves as `"other"` with raw text.

---

## 4. Gemini Nano is unavailable

**Failure:** Gemini Nano (Chrome's Built-in AI) isn't available on the current Chrome version, device, or hasn't been downloaded yet.

**What happens:** The Nano adapter checks `window.ai.languageModel.capabilities()` before attempting inference. If the result is `"no"` or the API throws, it falls back automatically to Gemini Cloud (same vendor, API key required).

**Data outcome:** Transparent to the user if a Gemini Cloud key is configured. If neither Nano nor Cloud is available, the fallback chain ends at the malformed-JSON recovery path.

**Note:** Gemini Nano requires Chrome 127+ with the Built-in AI Early Preview enabled. This is documented in the README and settings page.

---

## 5. User loses text selection before capture

**Failure:** User selects text, presses the keyboard shortcut, but the browser fires `selectionchange` between keypress and service worker response — losing the selection.

**What happens:** `content.js` runs a persistent `selectionchange` listener that pre-captures the current selection text on every change and stores it in a module-level variable. When the service worker sends `GET_SELECTION`, `content.js` returns the pre-captured value rather than calling `window.getSelection()` at that moment.

**Data outcome:** Selection is never lost between keypress and handler execution.

---

## 6. Supabase project is misconfigured or credentials are wrong

**Failure:** User enters an invalid Supabase URL or anon key in settings.

**What happens:** The Settings page has a "Test Connection" button that fires a lightweight `GET /rest/v1/captures?limit=1` probe and reports success or failure inline. If the test fails, sync is not attempted until the user corrects the credentials.

In production use, a failed upsert sets the sync-status dot to red. Subsequent captures continue saving locally; sync resumes when the connection recovers.

**Data outcome:** No captures are ever gated on Supabase connectivity.

---

## 7. Capture deleted by mistake

**Failure:** User deletes a capture they later want.

**What happens:** Deletes in the extension set `deleted_at = now()` via `PATCH` to Supabase. The row is never hard-deleted. Locally, the capture is removed from the `chrome.storage.local` array (a future recovery UI could read from Supabase to un-delete).

**Cost:** The Supabase table grows indefinitely. At personal-tool scale (thousands of rows, not millions), this is not a real constraint.

---

## 8. Extension service worker is killed mid-save

**Failure:** Chrome terminates the MV3 service worker between the local write and the Supabase upsert.

**What happens:** `chrome.storage.local` writes are synchronous from the caller's perspective — the `await chrome.storage.local.set()` completes before the service worker exits the save handler. The Supabase upsert is non-blocking and may not fire.

**Data outcome:** The capture is always in local storage. The Supabase row may be missing until the next save event triggers a sync. The sync-status dot will be grey (not configured) rather than red (error), so this failure mode is currently invisible to the user.

**Known gap:** There is no retry queue for failed upserts. A missed sync stays missed until the next capture or manual re-trigger. Acceptable at current scale.

---

## Known Limitations

These are not bugs — they are deliberate scope constraints with real consequences.

| Limitation | Impact | Rationale |
|---|---|---|
| No edit history / undo | If you edit a capture's reason and save, the previous reason is gone | Editing is opt-in and rare; full audit log adds schema complexity for minimal benefit |
| No conflict resolution | If local and Supabase diverge (e.g., edit offline + edit in web app), last-write-wins | Single user — concurrent editing from two devices simultaneously is an edge case I'm willing to accept |
| No mobile support | Captures only happen from desktop Chrome | Mobile would require a separate codebase. The saving behaviour I'm solving for is desktop-dominant. |
| LLM can misclassify | An article saved as "idea", a recipe saved as "article" | Mitigated by the Re-classify button and inline edit mode. The fallback to "other" is always recoverable. |
| Gemini Nano requires Chrome 127+ flag | Users on older Chrome or without the flag enabled get automatic Cloud fallback | Documented in README. The flag is a Chrome experimental feature, not something I control. |
| Web app has no auth layer | The web app reads Supabase using the anon key stored in localStorage | Single-user design — no multi-tenant auth needed. The Supabase anon key has row-level-security policies to restrict read/write to the user's own rows. |
| No background sync queue | Captures missed during network outage are not automatically re-synced | The next capture's upsert will succeed for that capture only. Historical missed syncs require a manual re-export + re-import. |
| Distillation is not deterministic | Two runs of the distillation LLM call on the same text may return slightly different bullets | LLM non-determinism is inherent. Mitigated by caching the first result — subsequent detail opens are identical. |
