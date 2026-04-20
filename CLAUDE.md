# Intent

## BOOT SEQUENCE (run silently every session)
1. **READ STATE:** Read `STATE_LEDGER.md`. Identify the ACTIVE TASK. Do not suggest work on NEXT IN QUEUE items.
2. **EXECUTE:** Run the user's prompt using the mandates and response structure below.
3. **UPDATE STATE** (if task completed): Edit `STATE_LEDGER.md` — move finished task to COMPLETED, promote top NEXT IN QUEUE item to ACTIVE TASK. Save the file.

If `STATE_LEDGER.md` is missing or ACTIVE TASK is blank, refuse to operate. Demand the user set it first.

---

## PROJECT CONTEXT

**What it does:** Chrome extension that captures why something mattered, not just what you saved.

**Stack:** JavaScript (vanilla ES modules) / Chrome Extension MV3 / chrome.storage.local / Vanilla HTML/CSS/JS
**Package manager:** npm
**Test framework:** Manual (no automated test runner — load unpacked in Chrome)
**Lint / format:** eslint
**Infra:** Chrome Extension (load unpacked, no build step)

**Key commands:**
```bash
# Test (single, not full suite)
# Load unpacked at chrome://extensions, open DevTools on background worker, trigger action manually

# Lint
npx eslint src/

# Dev server
# No dev server — reload extension at chrome://extensions after changes

# Build
# No build step — load unpacked directly from project root
```

**Constraints:**
- No sync across devices (MVP)
- No sharing or collaboration (MVP)
- No search functionality (MVP)
- No export (MVP)
- No mobile app
- No account or login
- No editing of saved captures

**Hardware:** Standard local machine; LM Studio optional for dev (runs mistral-7b-instruct or llama3-8b-instruct locally)

**Architecture notes:** MV3 Chrome Extension with three components: Content Script (selection detection + toast), Background Service Worker (API orchestration, storage CRUD, shortcut handling), Popup + Settings UI. Single `llm.js` adapter abstracts Anthropic Messages API and LM Studio OpenAI-compatible endpoint — backend is a config value, not a code branch. `chrome.storage.local` only, no remote DB. Strict JSON LLM output with `max_tokens: 300`. Graceful fallback to intent `other` on JSON parse failure — no capture is ever silently lost.

---

## RULES

**Code**
- Match existing style. Never introduce patterns not already in the codebase.
- Touch only files relevant to the current task.
- Prefer explicit over clever. No over-engineering.
- Run the relevant test after every change. Not the full suite.
- If a task will touch more than 3 files, confirm scope before starting.

**Scope**
- Flag scope creep immediately. Do not silently expand the task.
- If the user asks to work outside the ACTIVE TASK, name the conflict and ask for an explicit decision.

**Context hygiene**
- Use subagents for codebase research: `use a subagent to investigate X`.
- After completing a task, output: `Run /compact to compress session.`
- When compacting: preserve modified file list, test commands run, and unresolved decisions.

**Output**
- No preamble. No filler. Code blocks for code only.
- If blocked, state the blocker in one sentence and stop.

---

## RESPONSE STRUCTURE

**Situation:** One sentence. What is actually happening, including any scope issue or avoided reality.

**Steps:** Numbered. Hyper-specific. Code blocks contain only the relevant functional block — no boilerplate unless asked.

**Next action:** The single thing the user must do or verify before the next exchange. Demand proof for non-trivial steps.

---

## EMERGENCY RECOVERY

If session context is lost: demand `_STATE_LEDGER.md` contents before answering any technical question. Do not guess codebase state.

---

## SKILLS (load on demand — never preload)

Global skills (available in all projects):

| Need | Trigger |
|------|---------|
| Debug a failure | `use the debugger skill` |
| Write or update docs | `use the documenter skill` |
| Plan features or sprints | `use the pm skill` |
| Write or review tests | `use the tester skill` |
| Code quality review | `use the reviewer skill` |
| System or architecture design | `use the architect skill` |
| Backend API / DB / auth work | `use the backend-dev skill` |
| Frontend / UI / components | `use the frontend-dev skill` |
| ML, data pipelines, RAG, evals | `use the ai-engineer skill` |
| Challenge a plan or decision | `use the critic skill` |

Project-specific skills (this repo only):

| Need | Trigger |
|------|---------|
| Chrome Extension MV3 patterns (service worker, content script messaging, chrome.storage, CSP) | `use the chrome-extension skill` |
| LLM adapter work (Anthropic API, LM Studio, retry logic, JSON parse fallback) | `use the api-integration skill` |
