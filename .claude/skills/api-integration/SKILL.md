---
name: api-integration
description: >
  Activate when working on llm.js — the LLM adapter that calls Anthropic Messages API
  or LM Studio OpenAI-compatible endpoint. Also activate for error handling, retry logic,
  classification prompt changes, or JSON parse fallback logic.
  Do NOT activate for Chrome Extension plumbing or UI work.
allowed-tools: Read, Edit, Bash, Glob
---

# LLM API Integration (Intent)

## Constraints
- The same `classify()` function must work against both Anthropic (`https://api.anthropic.com/v1/messages`) and LM Studio (`http://localhost:1234/v1/chat/completions`). Backend is a runtime config value — no if/else branches in calling code.
- `max_tokens: 300`. Classification is narrow; more tokens waste latency and money.
- Output must be strict JSON. No markdown fences. No explanation text. If parsing fails, fall back to `intent: "other"` — never throw or drop the capture.
- Anthropic API requires `anthropic-version: 2023-06-01` header and `x-api-key` auth. LM Studio uses `Authorization: Bearer` (value can be anything or empty).
- No retries on 4xx (bad key, bad request) — surface the error immediately. Single retry on network errors / 5xx only.

## Core patterns

### 1. Unified classify() entry point
```js
// src/llm.js
export async function classify({ text, url, pageTitle }, settings) {
  const prompt = buildPrompt(text, url, pageTitle);

  try {
    const raw = settings.provider === 'anthropic'
      ? await callAnthropic(prompt, settings.apiKey)
      : await callLMStudio(prompt, settings.lmStudioUrl);

    return parseResponse(raw);
  } catch (err) {
    if (err.status >= 400 && err.status < 500) throw err; // surface auth/bad-request errors
    // Network or 5xx — one retry
    try {
      const raw = settings.provider === 'anthropic'
        ? await callAnthropic(prompt, settings.apiKey)
        : await callLMStudio(prompt, settings.lmStudioUrl);
      return parseResponse(raw);
    } catch {
      return fallbackCapture(text);
    }
  }
}
```

### 2. Anthropic Messages API call
```js
async function callAnthropic(prompt, apiKey) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }
  const data = await res.json();
  return data.content[0].text;
}
```

### 3. LM Studio (OpenAI-compatible) call
```js
async function callLMStudio(prompt, baseUrl) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'local-model', // LM Studio ignores this value
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) { const e = new Error(await res.text()); e.status = res.status; throw e; }
  const data = await res.json();
  return data.choices[0].message.content;
}
```

### 4. Classification prompt
```js
function buildPrompt(text, url, pageTitle) {
  return `You are a classification engine. Analyse the input and return ONLY a JSON object — no markdown, no explanation.

Input:
- Selected text: "${text.slice(0, 300)}"
- Page URL: "${url}"
- Page title: "${pageTitle}"

Classify the intent into exactly one of: book, movie, article, idea, quote, product, recipe, other.

Return this exact shape:
{
  "intent": "<one of the 8 types>",
  "title": "<extracted or inferred title, ≤ 60 chars>",
  "reason": "<one sentence: why this was worth saving>",
  "extract": "<key fact or quote from the text, ≤ 100 chars>"
}`;
}
```

### 5. JSON parse with fallback
```js
function parseResponse(raw) {
  try {
    // Strip accidental markdown fences if model misbehaves
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return fallbackCapture(raw);
  }
}

function fallbackCapture(rawText) {
  return { intent: 'other', title: 'Untitled capture', reason: 'Classification failed', extract: String(rawText).slice(0, 100) };
}
```

## Common failure modes

**1. Anthropic returns 401 — missing or invalid API key**
Symptom: `{"type":"error","error":{"type":"authentication_error",...}}` with status 401.
Fix: Surface immediately (4xx branch above). In background.js, catch this and send `TOAST` with "API key error — check extension settings".

**2. LM Studio not running — `net::ERR_CONNECTION_REFUSED`**
Symptom: fetch throws `TypeError: Failed to fetch`.
Fix: Catch in the retry block. Send toast "Could not save — check LM Studio connection". No retry needed for connection refused.

**3. Model returns markdown-fenced JSON**
Symptom: `JSON.parse` fails on ` ```json\n{...}\n``` `.
Fix: The `replace` in `parseResponse` handles this. If a new model wraps differently, add a more aggressive strip: `raw.replace(/[^{]*([\s\S]*})[^}]*/m, '$1')`.

**4. LM Studio model returns extra prose before JSON**
Symptom: Model says "Sure! Here is the classification: {...}" — parse fails.
Fix: Extract the JSON object with regex before parsing: `const match = raw.match(/\{[\s\S]*\}/); if (match) return JSON.parse(match[0]);`

**5. `max_tokens` too low — JSON truncated**
Symptom: `JSON.parse` fails with "Unexpected end of JSON input".
Fix: 300 tokens is enough for the defined output shape. If you expand the schema, recalculate: ~4 chars/token, shape is ~150 chars. Do not raise above 500 without benchmarking latency impact.

## Protocol

**Changing the classification prompt:**
1. Edit `buildPrompt()` in `llm.js`.
2. Test against LM Studio first (free, instant).
3. Check all 8 intent types with representative text samples — book mention, movie title, raw idea, short quote.
4. Only switch to Anthropic once LM Studio output looks correct.
5. Verify `parseResponse()` handles the new shape — if you added fields, update the fallback object too.
