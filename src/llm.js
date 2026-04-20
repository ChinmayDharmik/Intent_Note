/**
 * llm.js — LLM Adapter
 * Abstracts Anthropic Messages API and LM Studio OpenAI-compatible endpoint
 * behind a single interface. Backend is a runtime config value, not a code branch.
 *
 * Exports:
 *   classify(text, url, pageTitle, settings) → { intent, title, reason, extract }
 *   loadSettings()                           → { provider, anthropicApiKey, lmstudioBaseUrl, lmstudioModel }
 *   saveSettings(settings)                   → void
 */

// ─── Settings ──────────────────────────────────────────────────────────────────

const SETTINGS_KEY = "intentSettings";

const DEFAULTS = {
  provider: "lmstudio",
  lmstudioBaseUrl: "http://localhost:1234/v1",
  lmstudioModel: "local-model",
  anthropicApiKey: "",
};

export async function loadSettings() {
  const result = await chrome.storage.sync.get(SETTINGS_KEY);
  return { ...DEFAULTS, ...(result[SETTINGS_KEY] || {}) };
}

export async function saveSettings(settings) {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: settings });
}

// ─── Classification ────────────────────────────────────────────────────────────

/**
 * Classify a piece of text and return structured intent data.
 * Falls back to intent "other" on any parse failure — no capture is ever lost.
 */
/**
 * Classify a piece of text using the configured LLM backend.
 * Returns a structured object with intent, title, reason, and extract.
 * Falls back to the "other" intent on any failure.
 */
export async function classify(text, url, pageTitle, settings) {
  const prompt = buildPrompt(text, url, pageTitle);

  try {
    const raw = await callWithRetry(prompt, settings);
    return parseResponse(raw, text);
  } catch (err) {
    // 4xx = auth / schema error — surface immediately, do not retry further
    if (err.status >= 400 && err.status < 500) throw err;
    // Anything else that survived the retry — return fallback so capture is not lost
    return fallbackResult(text);
  }
}

// ─── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(text, url, pageTitle) {
  return `You are a classification engine. Analyse the input and return ONLY a JSON object — no markdown fences, no explanation, nothing else.

Input:
- Selected text: "${text.slice(0, 300)}"
- Page URL: "${url}"
- Page title: "${pageTitle}"

Classify the intent as exactly one of: book, movie, article, idea, quote, product, recipe, other.

Use these signals:
- book: book title, author name, "worth reading", ISBN, "by [Author]"
- movie: film title, director, streaming platform, "watch", "cinema"
- article: news, blog post, essay, "read later", byline, publication name
- idea: concept, framework, mental model, insight, "think about"
- quote: memorable sentence, attributed phrase, "said", quotation marks
- product: app, tool, software, hardware, SaaS, "try this"
- recipe: food, ingredients, cooking, dish name, cuisine
- other: does not clearly fit any above

Return this exact JSON shape and nothing else:
{
  "intent": "<one of the 8 types>",
  "title": "<extracted or inferred title, max 60 chars>",
  "reason": "<one sentence: why this was worth saving, max 120 chars>",
  "extract": "<the most important fact or phrase from the text, max 100 chars>"
}`;
}

// ─── API Calls ─────────────────────────────────────────────────────────────────

/**
 * Single retry on network errors and 5xx. Throws immediately on 4xx.
 */
async function callWithRetry(prompt, settings) {
  try {
    return await callLLM(prompt, settings);
  } catch (err) {
    if (err.status >= 400 && err.status < 500) throw err;
    // One retry for network / 5xx
    return await callLLM(prompt, settings);
  }
}

async function callLLM(prompt, settings) {
  return settings.provider === "anthropic"
    ? callAnthropic(prompt, settings.anthropicApiKey)
    : callLMStudio(prompt, settings.lmstudioBaseUrl, settings.lmstudioModel);
}

async function callAnthropic(prompt, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    const err = new Error("Anthropic API key not set — open extension settings");
    err.status = 401;
    throw err;
  }

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });
  } catch (networkErr) {
    throw new Error("Could not reach Anthropic API — check your connection");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(
      res.status === 401 ? "Invalid Anthropic API key — check extension settings" :
      res.status === 403 ? "Anthropic API key lacks permission" :
      `Anthropic error ${res.status}: ${body.slice(0, 120)}`
    );
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callLMStudio(prompt, baseUrl, model) {
  const url = (baseUrl || "http://localhost:1234/v1").replace(/\/$/, "");

  let res;
  try {
    res = await fetch(`${url}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "local-model",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
      }),
    });
  } catch (networkErr) {
    throw new Error("Could not reach LM Studio — is it running with CORS enabled?");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`LM Studio error ${res.status}: ${body.slice(0, 120)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ─── Response Parsing ──────────────────────────────────────────────────────────

const VALID_INTENTS = new Set([
  "book", "movie", "article", "idea", "quote", "product", "recipe", "other"
]);

function parseResponse(raw, originalText) {
  try {
    // Strip accidental markdown fences (some models wrap output in ```json ... ```)
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    // If the model prepended prose, extract just the JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON object found in response");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      intent:  VALID_INTENTS.has(parsed.intent) ? parsed.intent : "other",
      title:   sanitize(parsed.title,   60) || "Untitled",
      reason:  sanitize(parsed.reason,  120) || "Saved from " + new URL("about:blank").href,
      extract: sanitize(parsed.extract, 100) || "",
    };
  } catch {
    return fallbackResult(originalText);
  }
}

function sanitize(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

function fallbackResult(originalText) {
  return {
    intent:  "other",
    title:   "Untitled capture",
    reason:  "Classification failed — saved as-is",
    extract: String(originalText || "").slice(0, 100),
  };
}
