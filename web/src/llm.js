const SETTINGS_KEY = "intentWebSettings";

const DEFAULTS = {
  provider: "anthropic",
  anthropicApiKey: "",
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
