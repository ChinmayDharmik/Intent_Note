/**
 * popup.js — Popup UI
 * Includes visible error reporting for environments where DevTools is unavailable.
 */

// ─── State ─────────────────────────────────────────────────────────────────────

let allCaptures = [];
let activeFilter = "all";

// ─── Elements ──────────────────────────────────────────────────────────────────

const feed         = document.getElementById("feed");
const empty        = document.getElementById("empty");
const captureCount = document.getElementById("captureCount");
const quickInput   = document.getElementById("quickInput");
const saveQuickBtn  = document.getElementById("saveQuickBtn");
const attachPageBtn = document.getElementById("attachPageBtn");
const settingsBtn   = document.getElementById("settingsBtn");
const tabs         = document.getElementById("tabs");
const errorBanner  = document.getElementById("errorBanner");
const searchInput = document.getElementById("searchInput");
let searchQuery = "";
let attachPage  = true;

// ─── Error Display ─────────────────────────────────────────────────────────────

function showError(msg) {
  errorBanner.textContent = "⚠ " + msg;
  errorBanner.classList.remove("hidden");
}

function hideError() {
  errorBanner.classList.add("hidden");
}

// ─── Init ──────────────────────────────────────────────────────────────────────

/**
 * Initialize the popup UI.
 * Fetches captures and settings from the background worker, displays errors if any, and triggers the first render.
 */
async function init() {
  try {
    // Verify background worker is reachable
    const res = await chrome.runtime.sendMessage({ type: "GET_CAPTURES" });

    if (chrome.runtime.lastError) {
      showError("Background worker unreachable. Try reloading the extension.");
      return;
    }

    allCaptures = res?.captures || [];

    // Check if settings are configured
    const settingsRes = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
    const settings = settingsRes?.settings;

    if (!settings) {
      showError("Could not load settings. Click the gear icon to configure.");
    } else if (settings.provider === "anthropic" && !settings.anthropicApiKey) {
      showError("Anthropic API key not set. Click ⚙ to add it.");
    } else if (settings.provider === "lmstudio") {
      // Silently check LM Studio is reachable
      checkLMStudio(settings.lmstudioBaseUrl || "http://localhost:1234/v1");
    }

    render();
  } catch (err) {
    showError("Startup error: " + err.message);
  }
}

/**
 * Verify that LM Studio is reachable and a model is loaded.
 * Shows an error banner on failure.
 */
async function checkLMStudio(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/models`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();
    if (!data?.data?.length) {
      showError("LM Studio: no model loaded. Load a model in LM Studio first.");
    }
  } catch {
    showError("LM Studio not reachable. Is it running with CORS enabled?");
  }
}

// ─── Render ────────────────────────────────────────────────────────────────────

/**
 * Render the capture feed based on the current active filter.
 * Updates the capture count and shows either the feed or the empty placeholder.
 */
function render() {
  let filtered = activeFilter === "all"
    ? allCaptures
    : allCaptures.filter((c) => c.intent === activeFilter);

  captureCount.textContent = `${allCaptures.length} saved`;
  // Apply search filter if query present (case‑insensitive)
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(c =>
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.reason && c.reason.toLowerCase().includes(q)) ||
      (c.rawText && c.rawText.toLowerCase().includes(q))
    );
  }

  updateTabBadges();

  if (filtered.length === 0) {
    feed.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  feed.classList.remove("hidden");
  empty.classList.add("hidden");
  feed.innerHTML = "";

  filtered.forEach((capture, i) => {
    feed.appendChild(buildCard(capture, i));
  });
}

function updateTabBadges() {
  const counts = {};
  allCaptures.forEach((c) => {
    counts[c.intent] = (counts[c.intent] || 0) + 1;
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    const filter = tab.dataset.filter;
    const count  = filter === "all" ? allCaptures.length : (counts[filter] || 0);

    let badge = tab.querySelector(".tab-badge");
    if (count > 0) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "tab-badge";
        tab.appendChild(badge);
      }
      badge.textContent = count;
    } else if (badge) {
      badge.remove();
    }
  });
}

/**
 * Create a DOM card element for a single capture.
 * Includes emoji, title, reason, metadata badge, timestamp, and delete button.
 * Attaches click handler to open the capture URL if present.
 */
function buildCard(capture, index) {
  const card = document.createElement("div");
  card.className = "card";
  card.dataset.id = capture.id;
  card.style.animationDelay = `${index * 30}ms`;

  const emoji = document.createElement("div");
  emoji.className = "card-emoji";
  emoji.textContent = capture.intentMeta?.emoji || "📌";

  const body = document.createElement("div");
  body.className = "card-body";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = capture.title || "Untitled";

  const reason = document.createElement("div");
  reason.className = "card-reason";
  reason.textContent = capture.reason || "";

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const badge = document.createElement("span");
  badge.className = "card-badge";
  badge.textContent = capture.intentMeta?.label || "Other";

  const time = document.createElement("span");
  time.className = "card-time";
  time.textContent = formatTime(capture.savedAt);

  meta.appendChild(badge);
  meta.appendChild(time);
  body.appendChild(title);
  body.appendChild(reason);
  body.appendChild(meta);

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "card-delete";
  deleteBtn.title = "Delete";
  deleteBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M1.5 1.5l8 8M9.5 1.5l-8 8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;

  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleDelete(capture.id, card);
  });

  card.appendChild(emoji);
  card.appendChild(body);
  card.appendChild(deleteBtn);

  if (capture.url) {
    card.addEventListener("click", () => {
      chrome.tabs.create({ url: capture.url });
    });
  }

  return card;
}

// ─── Quick Capture ─────────────────────────────────────────────────────────────

/**
 * Handle quick‑capture input.
 * Sends the entered text to the background worker, shows a loading spinner, and updates the feed on success.
 */
async function handleQuickSave() {
  const text = quickInput.value.trim();
  if (!text) return;

  saveQuickBtn.disabled = true;
  saveQuickBtn.classList.add("loading");
  quickInput.disabled = true;
  hideError();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const res = await chrome.runtime.sendMessage({
      type: "SAVE_SELECTION",
      payload: {
        text,
        url:       attachPage ? (tab?.url || "")   : "",
        pageTitle: attachPage ? (tab?.title || "") : "",
      },
    });

    if (res?.success) {
      quickInput.value = "";
      allCaptures.unshift(res.capture);
      render();
      const firstCard = feed.querySelector(".card");
      if (firstCard) {
        firstCard.style.borderColor = "#3f3f46";
        setTimeout(() => { firstCard.style.borderColor = ""; }, 800);
      }
    } else {
      showError(res?.error || "Could not save. Check settings.");
    }
  } catch (err) {
    showError("Save failed: " + err.message);
  } finally {
    saveQuickBtn.disabled = false;
    saveQuickBtn.classList.remove("loading");
    quickInput.disabled = false;
    quickInput.focus();
  }
}

saveQuickBtn.addEventListener("click", handleQuickSave);

attachPageBtn.addEventListener("click", () => {
  attachPage = !attachPage;
  attachPageBtn.classList.toggle("active", attachPage);
  attachPageBtn.textContent = attachPage ? "+ link" : "link";
});
searchInput.addEventListener("keyup", (e) => {
  searchQuery = e.target.value;
  render();
});
quickInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleQuickSave();
  if (e.key === "Escape") quickInput.blur();
});
// ─── Delete ────────────────────────────────────────────────────────────────────

/**
 * Delete a capture card.
 * Animates removal, tells the background to delete from storage, then re‑renders the feed.
 */
async function handleDelete(id, cardEl) {
  cardEl.style.transition = "opacity 0.15s, transform 0.15s";
  cardEl.style.opacity = "0";
  cardEl.style.transform = "translateX(6px)";

  await chrome.runtime.sendMessage({ type: "DELETE_CAPTURE", payload: { id } });
  allCaptures = allCaptures.filter((c) => c.id !== id);

  setTimeout(render, 150);
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

tabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".tab");
  if (!tab) return;
  document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
  activeFilter = tab.dataset.filter;
  render();
});

// ─── Export ────────────────────────────────────────────────────────────────────

const exportBtn  = document.getElementById("exportBtn");
const exportMenu = document.getElementById("exportMenu");

exportBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  exportMenu.classList.toggle("hidden");
});

exportMenu.addEventListener("click", (e) => {
  const option = e.target.closest(".export-option");
  if (!option) return;
  exportCaptures(option.dataset.format);
  exportMenu.classList.add("hidden");
});

document.addEventListener("click", () => exportMenu.classList.add("hidden"));

function exportCaptures(format) {
  if (!allCaptures.length) return;

  let content, filename, mime;

  if (format === "json") {
    content  = JSON.stringify(allCaptures, null, 2);
    filename = "intent-captures.json";
    mime     = "application/json";
  } else {
    content  = allCaptures.map((c) => {
      const lines = [`## ${c.title || "Untitled"}`];
      if (c.reason)   lines.push(`> ${c.reason}`);
      if (c.url)      lines.push(`[Source](${c.url})`);
      if (c.savedAt)  lines.push(`_Saved: ${new Date(c.savedAt).toLocaleString()}_`);
      return lines.join("\n");
    }).join("\n\n---\n\n");
    filename = "intent-captures.md";
    mime     = "text/markdown";
  }

  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a   = document.createElement("a");
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Settings ──────────────────────────────────────────────────────────────────

settingsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// ─── Utils ─────────────────────────────────────────────────────────────────────

/**
 * Human‑readable time formatting for capture timestamps.
 * Returns relative strings like "5m ago" or a short date for older entries.
 */
function formatTime(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  const now = new Date();
  const diffMin = Math.floor((now - date) / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1)  return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24)  return `${diffHr}h ago`;
  if (diffDay < 7)  return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

init();