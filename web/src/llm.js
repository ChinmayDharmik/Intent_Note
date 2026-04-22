const SETTINGS_KEY = "intentWebSettings";

const DEFAULTS = {
  provider: "anthropic",
  anthropicApiKey: "",
  geminiApiKey: "",
  lmstudioBaseUrl: "http://localhost:1234/v1",
  lmstudioModel: "local-model",
};

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function reclassify(capture) {
  const settings = loadSettings();
  const text = capture.raw_text || capture.extract || capture.title || "";

  const prompt = `You are an intent classifier. Given the captured text below, return ONLY a JSON object — no markdown, no explanation.

JSON shape: {"intent":"<book|movie|article|idea|quote|product|recipe|other>","title":"<concise title>","reason":"<one sentence why this mattered>","extract":"<key sentence or phrase>","tags":["3 to 5 short descriptive lowercase tags"]}

Text: ${text.slice(0, 600)}
URL: ${capture.url || ""}`;

  let raw = "";
  if (settings.provider === "anthropic") {
    if (!settings.anthropicApiKey) throw new Error("Anthropic API key not configured");
    raw = await classifyAnthropic(prompt, settings.anthropicApiKey);
  } else if (settings.provider === "gemini-cloud") {
    if (!settings.geminiApiKey) throw new Error("Gemini API key not configured");
    raw = await classifyGemini(prompt, settings.geminiApiKey);
  } else {
    raw = await classifyLMStudio(prompt, settings.lmstudioBaseUrl, settings.lmstudioModel);
  }

  try {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");
    const parsed = JSON.parse(match[0]);
    return {
      intent: parsed.intent || "other",
      title:  parsed.title  || capture.title || "Untitled",
      reason: parsed.reason || "",
      extract: parsed.extract || "",
      tags:   Array.isArray(parsed.tags)
        ? parsed.tags.map((t) => String(t).trim().toLowerCase().slice(0, 32)).filter(Boolean).slice(0, 5)
        : [],
    };
  } catch {
    return { intent: "other", title: capture.title || "Untitled", reason: "", extract: "", tags: [] };
  }
}

async function classifyAnthropic(prompt, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

async function classifyGemini(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 300, temperature: 0.1 } }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function classifyLMStudio(prompt, baseUrl, model) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export async function distill(capture) {
  const settings = loadSettings();
  const text = capture.extract || capture.raw_text || capture.title || "";

  const prompt = `Distill this captured content into exactly 3 bullet points capturing the core ideas.

Title: ${capture.title || "Untitled"}
Text: ${text.slice(0, 800)}

Return JSON only, no other text: {"bullets": ["...", "...", "..."]}`;

  if (settings.provider === "anthropic") {
    if (!settings.anthropicApiKey) throw new Error("Anthropic API key not configured");
    return distillAnthropic(prompt, settings.anthropicApiKey);
  }
  if (settings.provider === "gemini-cloud") {
    if (!settings.geminiApiKey) throw new Error("Gemini API key not configured");
    return distillGeminiCloud(prompt, settings.geminiApiKey);
  }
  return distillLMStudio(prompt, settings.lmstudioBaseUrl, settings.lmstudioModel);
}

async function distillAnthropic(prompt, apiKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const data = await res.json();
  return parseDistillation(data.content?.[0]?.text || "");
}

async function distillGeminiCloud(prompt, apiKey) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 200, temperature: 0.1 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return parseDistillation(data.candidates?.[0]?.content?.parts?.[0]?.text || "");
}

async function distillLMStudio(prompt, baseUrl, model) {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`LM Studio ${res.status}`);
  const data = await res.json();
  return parseDistillation(data.choices?.[0]?.message?.content || "");
}

function parseDistillation(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON");
    const parsed = JSON.parse(match[0]);
    if (!Array.isArray(parsed.bullets)) throw new Error("No bullets array");
    return parsed.bullets.filter(Boolean).slice(0, 3);
  } catch {
    return null;
  }
}
