/**
 * settings.js — Settings Page
 * Reads and writes directly to chrome.storage.sync.
 * Does NOT go through the background worker.
 */

const STORAGE_KEY = "intentSettings";

const DEFAULTS = {
  provider: "lmstudio",
  lmstudioBaseUrl: "http://localhost:1234/v1",
  lmstudioModel: "local-model",
  anthropicApiKey: "",
  supabaseUrl: "",
  supabaseAnonKey: "",
};

// ─── Elements ──────────────────────────────────────────────────────────────────

const providerBtns     = document.querySelectorAll(".toggle-btn");
const lmstudioSection  = document.getElementById("lmstudioSection");
const anthropicSection = document.getElementById("anthropicSection");
const lmBaseUrlInput   = document.getElementById("lmstudioBaseUrl");
const lmModelInput     = document.getElementById("lmstudioModel");
const apiKeyInput      = document.getElementById("anthropicApiKey");
const toggleKeyBtn     = document.getElementById("toggleKeyVisibility");
const supabaseUrlInput     = document.getElementById("supabaseUrl");
const supabaseAnonKeyInput = document.getElementById("supabaseAnonKey");
const toggleSupabaseKeyBtn = document.getElementById("toggleSupabaseKeyVisibility");
const saveBtn          = document.getElementById("saveBtn");
const testBtn          = document.getElementById("testBtn");
const statusEl         = document.getElementById("status");

let currentProvider = "lmstudio";

// ─── Init ──────────────────────────────────────────────────────────────────────

async function init() {
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY);
    const s = result[STORAGE_KEY] || DEFAULTS;

    currentProvider              = s.provider        || DEFAULTS.provider;
    lmBaseUrlInput.value         = s.lmstudioBaseUrl  || DEFAULTS.lmstudioBaseUrl;
    lmModelInput.value           = s.lmstudioModel    || DEFAULTS.lmstudioModel;
    apiKeyInput.value            = s.anthropicApiKey  || "";
    supabaseUrlInput.value       = s.supabaseUrl      || "";
    supabaseAnonKeyInput.value   = s.supabaseAnonKey  || "";

    setProvider(currentProvider);
  } catch (err) {
    showStatus("Failed to load settings: " + err.message, "error");
  }
}

// ─── Provider Toggle ───────────────────────────────────────────────────────────

function setProvider(value) {
  currentProvider = value;

  providerBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.value === value);
  });

  if (value === "lmstudio") {
    lmstudioSection.classList.remove("hidden");
    anthropicSection.classList.add("hidden");
  } else {
    lmstudioSection.classList.add("hidden");
    anthropicSection.classList.remove("hidden");
  }

  hideStatus();
}

providerBtns.forEach((btn) => {
  btn.addEventListener("click", () => setProvider(btn.dataset.value));
});

// ─── API Key Visibility ────────────────────────────────────────────────────────

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "🙈" : "👁";
});

toggleSupabaseKeyBtn.addEventListener("click", () => {
  const isPassword = supabaseAnonKeyInput.type === "password";
  supabaseAnonKeyInput.type = isPassword ? "text" : "password";
  toggleSupabaseKeyBtn.textContent = isPassword ? "🙈" : "👁";
});

// ─── Save ──────────────────────────────────────────────────────────────────────

saveBtn.addEventListener("click", async () => {
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    const settings = buildSettings();
    await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
    showStatus("Settings saved.", "success");
  } catch (err) {
    showStatus("Failed to save: " + err.message, "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save settings";
  }
});

// ─── Test Connection ───────────────────────────────────────────────────────────

testBtn.addEventListener("click", async () => {
  testBtn.disabled = true;
  testBtn.textContent = "Testing…";
  hideStatus();

  const settings = buildSettings();

  try {
    if (settings.provider === "lmstudio") {
      await testLMStudio(settings.lmstudioBaseUrl);
    } else {
      await testAnthropic(settings.anthropicApiKey);
    }
    showStatus("Connection successful.", "success");
  } catch (err) {
    showStatus("Failed: " + err.message, "error");
  } finally {
    testBtn.disabled = false;
    testBtn.textContent = "Test connection";
  }
});

async function testLMStudio(baseUrl) {
  const url = (baseUrl || "http://localhost:1234/v1").replace(/\/$/, "");
  const res = await fetch(`${url}/models`);
  if (!res.ok) throw new Error(`LM Studio returned ${res.status}`);
  const data = await res.json();
  if (!data?.data?.length) throw new Error("No models loaded in LM Studio");
}

async function testAnthropic(apiKey) {
  if (!apiKey || !apiKey.trim()) throw new Error("API key is empty");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey.trim(),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 10,
      messages: [{ role: "user", content: "Hi" }],
    }),
  });

  if (res.status === 401) throw new Error("Invalid API key — check and re-enter");
  if (res.status === 403) throw new Error("API key doesn't have permission");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${body.slice(0, 100)}`);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function buildSettings() {
  return {
    provider:        currentProvider,
    lmstudioBaseUrl: lmBaseUrlInput.value.trim() || DEFAULTS.lmstudioBaseUrl,
    lmstudioModel:   lmModelInput.value.trim()   || DEFAULTS.lmstudioModel,
    anthropicApiKey: apiKeyInput.value.trim(),
    supabaseUrl:     supabaseUrlInput.value.trim(),
    supabaseAnonKey: supabaseAnonKeyInput.value.trim(),
  };
}

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove("hidden");
}

function hideStatus() {
  statusEl.classList.add("hidden");
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

init();