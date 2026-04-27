# Trade-offs and Decision Rationale

Every decision below was a real fork in the road. I documented the alternative I didn't pick and why.

---

## 1. Offline-first vs cloud-first storage

**Chose:** Offline-first. `chrome.storage.local` is the source of truth. Supabase sync is async, non-blocking, optional.

**Alternative:** Cloud-first — every capture writes straight to Supabase, local cache secondary.

**Why offline-first:**
- A capture must never fail because the network is flaky. The whole point is to remove friction; adding a "retry save?" dialog reintroduces it.
- Supabase is optional. The extension has to work with zero config.
- My home wifi drops. My phone tether drops. My coffee shop wifi is garbage. I save things in all those situations.

**Cost:** Eventual consistency. If I save on my laptop, then on my phone simulator before sync catches up, I could theoretically see ordering glitches. Acceptable — I'm the only user of my own install.

---

## 2. No Supabase SDK in the extension

**Chose:** Plain `fetch()` calls against the Supabase REST API.

**Alternative:** `@supabase/supabase-js` — the official SDK.

**Why plain fetch:**
- MV3 Content Security Policy treats bundled SDK code with suspicion. You can make it work, but it requires loosening CSP or bundling with a specific loader strategy.
- The SDK pulls in `postgrest-js`, `realtime-js`, `storage-js`, `gotrue-js`. I don't need realtime in the extension (it's a writer, not a reader), don't need Storage, don't need Auth. 80% of the SDK is dead weight.
- A soft-delete upsert is a single `PATCH /rest/v1/captures`. I can write that in 15 lines.

**Cost:** I gave up type safety and the nice chainable API. In exchange the extension bundle is smaller, has no CSP risk, and I understand every line.

---

## 3. Lazy distillation (not eager)

**Chose:** Distillation (the 3-bullet AI summary) runs when the user first opens a capture's detail view in the web app. Cached back to Supabase.

**Alternative:** Generate it at capture time, in the same LLM call as classification.

**Why lazy:**
- Most captures never get re-visited. Spending LLM tokens on summaries no one reads is wasteful.
- Classification is fast (short prompt, ~300 tokens out). Adding distillation to the same call would double the latency and hurt the `< 2s` capture feel.
- The detail view is inherently a pause-and-reflect moment. A 2-second AI summary load there is tolerable; at capture time it isn't.

**Cost:** Slight friction on first detail-view open. Mitigated by a progress shimmer and by caching.

---

## 4. No build step for the extension

**Chose:** Plain ES modules, load unpacked, no bundler.

**Alternative:** Vite / Webpack / esbuild, bundled output in `dist/`.

**Why no build:**
- MV3 extension code is small. The whole extension is ~40 KB of JS minus fonts.
- Reload cycle is instant: edit → `chrome://extensions` → reload. With a bundler, I add a watch process and a second terminal.
- Every dependency added increases review surface. `fetch()` and `chrome.*` APIs are enough.

**Cost:** No TypeScript (I'd want a build step for that), no tree-shaking, no minification. Acceptable given bundle size.

The web app *does* use Vite — because there it buys something (HMR on a real dev server, `.env` injection, proper module resolution for its CSS).

---

## 5. Light theme ("Digital Sanctuary") over dark

**Chose:** Warm light palette — `#fdf9f5` primary, `#f7f3ef` secondary, Noto Serif + Manrope.

**Alternative:** The original dark theme (`#0c0c0d` / DM Sans / DM Serif Display) that I shipped in v1.

**Why light:**
- Intent is a reflection tool. The mental model should feel like a paper notebook on a desk, not a terminal. The warm cream + serif headings sell that feeling; dark mode sells "developer tool."
- Most *reading* tools (Kindle, Books, Instapaper) default to warm light. Dark is for coding contexts.
- The "no-borders" design system (hierarchy through background shifts, not lines) works much better on light surfaces. Dark mode with stacked tonal surfaces looks muddy.

**Cost:** Breaks from the current popular default. I added no light/dark toggle — if a user specifically wants dark, this tool isn't for them right now.

---

## 6. Four LLM providers (Gemini Nano default)

**Chose:** Gemini Nano as the default, with Gemini Cloud as automatic fallback. Anthropic and LM Studio as explicit opt-in.

**Alternative A:** Single provider (Anthropic only, like v1).
**Alternative B:** Let user bring any OpenAI-compatible endpoint.

**Why this shape:**
- Gemini Nano means zero cost, zero latency, zero data exfiltration by default. A user can install the extension and have it work without signing up for anything or entering a key.
- Anthropic is there for quality-sensitive users willing to pay.
- LM Studio is there for the privacy-absolutists who won't send data anywhere.
- OpenAI-compatible endpoint would be N+1 — LM Studio already covers self-hosted; I didn't see enough demand to justify a generic adapter that everyone has to configure.

**Cost:** Four code paths to maintain, four failure modes to reason about. Mitigated by a single `classify()` interface and strict JSON envelope that normalizes output across providers.

---

## 7. Soft-delete in Supabase

**Chose:** `PATCH deleted_at = now()`. Never hard-delete.

**Alternative:** `DELETE /rest/v1/captures?id=eq.x` — hard delete.

**Why soft:**
- My past self hits "delete" on saved things I later wish I had. The cost of soft-delete is one extra filter in read queries; the cost of hard-delete is lost data I can't recover.
- In a single-user system with no quota pressure, there's no reason to hard-delete ever.

**Cost:** Table grows forever. Not a real cost at my scale.

---

## 8. Personal Supabase project (anon key) over multi-tenant backend

**Chose:** Each user brings their own Supabase project and pastes URL + anon key into settings.

**Alternative:** A hosted backend I run, with auth and per-user rows.

**Why BYO Supabase:**
- I don't want to run a service. I don't want liability for someone else's data. I don't want an ongoing bill.
- Supabase's free tier is generous; setting up a project takes 2 minutes.
- This keeps Intent a personal tool. Each user's data is in their own Postgres. If Intent disappears, their data doesn't.

**Cost:** Non-zero friction at setup. Mitigated by making sync optional — the extension works perfectly without any of this. The web app is the only thing that needs it.

---

## 9. No editing in v1 → editing in v2

**Chose:** In v2, allow editing title, reason, intent, and tags. Added a "re-classify" button that reruns the LLM on the raw text.

**Alternative:** Original "no editing" constraint from v1 — treating captures as immutable journal entries.

**Why I changed my mind:**
- The LLM is wrong sometimes. When it classifies a recipe as an "article," the correct response is *fix it*, not *live with it*. Immutability was a principle, not a user need.
- The moment of capture is still friction-minimized (edit is opt-in, after the fact).
- Re-classify is specifically useful when I've written a better reason in the edit box and want the LLM to re-derive title from it.

**Cost:** More UI surface. More failure modes (edit mid-sync? conflict?). Handled by write-through-local + fire-and-forget sync.
