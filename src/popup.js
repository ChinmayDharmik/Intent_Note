/**
 * popup.js — Popup UI
 * Includes visible error reporting for environments where DevTools is unavailable.
 */

// ─── Constants ─────────────────────────────────────────────────────────────────

const INTENT_META = {
  book:    { label: "Book",    emoji: "📚" },
  movie:   { label: "Movie",   emoji: "🎬" },
  article: { label: "Article", emoji: "📰" },
  idea:    { label: "Idea",    emoji: "💡" },
  quote:   { label: "Quote",   emoji: "💬" },
  product: { label: "Product", emoji: "🛍️" },
  recipe:  { label: "Recipe",  emoji: "🍳" },
  other:   { label: "Other",   emoji: "📌" },
};

const INTENT_OPTIONS = ["book", "movie", "article", "idea", "quote", "product", "recipe", "other"];

// ─── State ─────────────────────────────────────────────────────────────────────

let allCaptures = [];
let activeFilter = "all";
let activeTag = null;

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
const searchInput  = document.getElementById("searchInput");
const syncDot      = document.getElementById("syncDot");
const tagCloud     = document.getElementById("tagCloud");
let searchQuery = "";
let attachPage  = true;

// ─── Error Display ─────────────────────────────────────────────────────────────

function updateSyncDot(status) {
  syncDot.className = "sync-dot" + (status ? ` ${status}` : "");
  const labels = { syncing: "Syncing…", synced: "Synced", error: "Sync error" };
  syncDot.title = labels[status] || "Sync not configured";
}

chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.syncStatus) updateSyncDot(changes.syncStatus.newValue);
});

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

    const syncRes = await chrome.storage.local.get("syncStatus");
    updateSyncDot(syncRes?.syncStatus || null);
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

  if (activeTag) {
    filtered = filtered.filter((c) => (c.tags || []).includes(activeTag));
  }

  captureCount.textContent = `${allCaptures.length} saved`;
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(c =>
      (c.title && c.title.toLowerCase().includes(q)) ||
      (c.reason && c.reason.toLowerCase().includes(q)) ||
      (c.rawText && c.rawText.toLowerCase().includes(q)) ||
      (c.tags || []).some(t => t.includes(q))
    );
  }

  updateTabBadges();
  renderTagCloud();

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

function renderTagCloud() {
  const intentFiltered = activeFilter === "all"
    ? allCaptures
    : allCaptures.filter((c) => c.intent === activeFilter);

  const counts = {};
  intentFiltered.forEach((c) => {
    (c.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; });
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t);

  if (sorted.length === 0 && !activeTag) {
    tagCloud.classList.add("hidden");
    return;
  }

  tagCloud.classList.remove("hidden");
  tagCloud.innerHTML = "";

  if (activeTag) {
    const clearBtn = document.createElement("button");
    clearBtn.className = "tag-clear-btn";
    clearBtn.textContent = "✕ " + activeTag;
    clearBtn.addEventListener("click", () => { activeTag = null; render(); });
    tagCloud.appendChild(clearBtn);
  }

  sorted.filter((t) => t !== activeTag).forEach((tag) => {
    const chip = document.createElement("button");
    chip.className = "tag-cloud-chip";
    chip.textContent = tag;
    chip.addEventListener("click", () => { activeTag = tag; render(); });
    tagCloud.appendChild(chip);
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

  const tagsRow = document.createElement("div");
  tagsRow.className = "card-tags";

  (capture.tags || []).forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag-chip";

    const label = document.createElement("button");
    label.className = "tag-chip-text";
    label.textContent = tag;
    label.addEventListener("click", (e) => {
      e.stopPropagation();
      activeTag = tag;
      render();
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "tag-chip-remove";
    removeBtn.textContent = "×";
    removeBtn.title = "Remove tag";
    removeBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await handleRemoveTag(capture.id, tag);
    });

    chip.appendChild(label);
    chip.appendChild(removeBtn);
    tagsRow.appendChild(chip);
  });

  const addBtn = document.createElement("button");
  addBtn.className = "tag-add-btn";
  addBtn.textContent = "+ tag";
  addBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showTagInput(capture.id, tagsRow, addBtn);
  });
  tagsRow.appendChild(addBtn);

  body.appendChild(title);
  body.appendChild(reason);
  body.appendChild(tagsRow);
  body.appendChild(meta);

  const cardActions = document.createElement("div");
  cardActions.className = "card-actions";

  const editBtn = document.createElement("button");
  editBtn.className = "card-edit-btn";
  editBtn.title = "Edit";
  editBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M7.5 1.5l2 2L3 10H1V8L7.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  editBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showCardEditMode(card, capture);
  });

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

  cardActions.appendChild(editBtn);
  cardActions.appendChild(deleteBtn);

  card.appendChild(emoji);
  card.appendChild(body);
  card.appendChild(cardActions);

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
// ─── Tags ──────────────────────────────────────────────────────────────────────

function showTagInput(captureId, tagsRow, addBtn) {
  addBtn.classList.add("hidden");
  const input = document.createElement("input");
  input.className = "tag-input";
  input.placeholder = "add tag…";
  input.maxLength = 32;

  const commit = async () => {
    const val = input.value.trim().toLowerCase();
    input.remove();
    addBtn.classList.remove("hidden");
    if (val) await handleAddTag(captureId, val);
  };

  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") commit();
    if (e.key === "Escape") { input.remove(); addBtn.classList.remove("hidden"); }
  });
  input.addEventListener("blur", commit);
  input.addEventListener("click", (e) => e.stopPropagation());

  tagsRow.insertBefore(input, addBtn);
  input.focus();
}

async function handleAddTag(captureId, tag) {
  const normalized = tag.trim().toLowerCase().slice(0, 32);
  if (!normalized) return;
  await chrome.runtime.sendMessage({ type: "ADD_TAG", payload: { id: captureId, tag: normalized } });
  const capture = allCaptures.find((c) => c.id === captureId);
  if (capture) {
    capture.tags = capture.tags || [];
    if (!capture.tags.includes(normalized)) capture.tags.push(normalized);
  }
  render();
}

async function handleRemoveTag(captureId, tag) {
  await chrome.runtime.sendMessage({ type: "REMOVE_TAG", payload: { id: captureId, tag } });
  const capture = allCaptures.find((c) => c.id === captureId);
  if (capture) capture.tags = (capture.tags || []).filter((t) => t !== tag);
  render();
}

// ─── Edit ──────────────────────────────────────────────────────────────────────

function showCardEditMode(card, capture) {
  card.innerHTML = "";
  card.style.cursor = "default";

  const form = document.createElement("div");
  form.className = "card-edit-form";
  form.addEventListener("click", (e) => e.stopPropagation());

  const titleInput = document.createElement("input");
  titleInput.className = "card-edit-input";
  titleInput.value = capture.title || "";
  titleInput.placeholder = "Title";

  const reasonInput = document.createElement("textarea");
  reasonInput.className = "card-edit-textarea";
  reasonInput.value = capture.reason || "";
  reasonInput.placeholder = "Why did this matter?";
  reasonInput.rows = 2;

  const intentSelect = document.createElement("select");
  intentSelect.className = "card-edit-select";
  INTENT_OPTIONS.forEach((k) => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = `${INTENT_META[k].emoji} ${INTENT_META[k].label}`;
    if (k === capture.intent) opt.selected = true;
    intentSelect.appendChild(opt);
  });

  const tagsInput = document.createElement("input");
  tagsInput.className = "card-edit-input";
  tagsInput.value = (capture.tags || []).join(", ");
  tagsInput.placeholder = "Tags (comma-separated)";

  const actions = document.createElement("div");
  actions.className = "card-edit-actions";

  const reshuffleBtn = document.createElement("button");
  reshuffleBtn.className = "card-edit-reshuffle";
  reshuffleBtn.textContent = "↻ Re-classify";
  reshuffleBtn.addEventListener("click", async () => {
    reshuffleBtn.disabled = true;
    reshuffleBtn.textContent = "Classifying…";
    const res = await chrome.runtime.sendMessage({ type: "RECLASSIFY_CAPTURE", payload: { id: capture.id } });
    if (res?.success && res.classified) {
      titleInput.value  = res.classified.title  || "";
      reasonInput.value = res.classified.reason || "";
      intentSelect.value = res.classified.intent || capture.intent;
      tagsInput.value   = (res.classified.tags || []).join(", ");
    }
    reshuffleBtn.disabled = false;
    reshuffleBtn.textContent = "↻ Re-classify";
  });

  const saveBtn = document.createElement("button");
  saveBtn.className = "card-edit-save";
  saveBtn.textContent = "Save";
  saveBtn.addEventListener("click", async () => {
    const tags = tagsInput.value.split(",").map((t) => t.trim().toLowerCase().slice(0, 32)).filter(Boolean);
    await handleUpdateCapture(capture.id, {
      title:  titleInput.value.trim(),
      reason: reasonInput.value.trim(),
      intent: intentSelect.value,
      tags,
    });
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "card-edit-cancel";
  cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", () => render());

  actions.appendChild(reshuffleBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(cancelBtn);

  form.appendChild(titleInput);
  form.appendChild(reasonInput);
  form.appendChild(intentSelect);
  form.appendChild(tagsInput);
  form.appendChild(actions);
  card.appendChild(form);
  titleInput.focus();
}

async function handleUpdateCapture(id, fields) {
  const res = await chrome.runtime.sendMessage({ type: "UPDATE_CAPTURE", payload: { id, fields } });
  if (res?.success) {
    const capture = allCaptures.find((c) => c.id === id);
    if (capture) {
      Object.assign(capture, fields);
      capture.intentMeta = INTENT_META[fields.intent] || capture.intentMeta;
    }
    render();
  }
}

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