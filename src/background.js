/**
 * background.js — Service Worker
 * Orchestrates all API calls, storage operations, and message handling.
 * Content script and popup never touch storage or LLM directly.
 */

import { classify, loadSettings, saveSettings } from "./llm.js";

// ─── Intent Metadata ───────────────────────────────────────────────────────────

const INTENT_META = {
  book:    { label: "Book",    emoji: "📚", color: "#E8D5B7" },
  movie:   { label: "Movie",   emoji: "🎬", color: "#B7D5E8" },
  article: { label: "Article", emoji: "📰", color: "#D5E8B7" },
  idea:    { label: "Idea",    emoji: "💡", color: "#F5E6A3" },
  quote:   { label: "Quote",   emoji: "💬", color: "#E8B7D5" },
  product: { label: "Product", emoji: "🛍️", color: "#B7E8D5" },
  recipe:  { label: "Recipe",  emoji: "🍳", color: "#F5C9A3" },
  other:   { label: "Other",   emoji: "📌", color: "#E0E0E0" },
};

// ─── Storage Helpers ───────────────────────────────────────────────────────────

/**
 * Retrieve the array of saved captures from chrome.storage.local.
 * Returns an empty array if none exist.
 */
async function getCaptures() {
  const result = await chrome.storage.local.get("captures");
  return result.captures || [];
}

/**
 * Persist a new capture to storage, inserting it at the beginning of the array.
 * Returns the saved capture.
 */
async function saveCapture(capture) {
  const captures = await getCaptures();
  captures.unshift(capture); // newest first
  await chrome.storage.local.set({ captures });
  return capture;
}

/**
 * Remove a capture by its ID from storage.
 */
async function deleteCapture(id) {
  const captures = await getCaptures();
  const updated = captures.filter((c) => c.id !== id);
  await chrome.storage.local.set({ captures: updated });
}

/**
 * Delete all captures from storage.
 */
async function clearAllCaptures() {
  await chrome.storage.local.set({ captures: [] });
}

async function updateCapture(id, mutate) {
  const captures = await getCaptures();
  const i = captures.findIndex((c) => c.id === id);
  if (i < 0) return;
  mutate(captures[i]);
  await chrome.storage.local.set({ captures });
}

// ─── Supabase Sync ─────────────────────────────────────────────────────────────

function syncToLocal(capture) {
  fetch("http://localhost:47832/captures", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id:         capture.id,
      intent:     capture.intent,
      title:      capture.title,
      reason:     capture.reason,
      extract:    capture.extract,
      tags:       capture.tags || [],
      raw_text:   capture.rawText,
      url:        capture.url,
      page_title: capture.pageTitle,
      saved_at:   capture.savedAt,
      deleted_at: null,
    }),
  }).catch(() => {});
}

async function replayCapturesToLocal() {
  const captures = await getCaptures();
  captures.forEach(c => syncToLocal(c));
}

function softDeleteLocal(id) {
  fetch(`http://localhost:47832/captures/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  }).catch(() => {});
}

async function syncToSupabase(capture) {
  const settings = await loadSettings();
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;

  const endpoint = settings.supabaseUrl.replace(/\/$/, "") + "/rest/v1/captures";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": settings.supabaseAnonKey,
      "Authorization": `Bearer ${settings.supabaseAnonKey}`,
      "Prefer": "resolution=merge-duplicates",
    },
    body: JSON.stringify({
      id:         capture.id,
      intent:     capture.intent,
      title:      capture.title,
      reason:     capture.reason,
      extract:    capture.extract,
      tags:       capture.tags || [],
      raw_text:   capture.rawText,
      url:        capture.url,
      page_title: capture.pageTitle,
      saved_at:   capture.savedAt,
      deleted_at: null,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 100)}`);
  }
}

async function softDeleteInSupabase(id) {
  const settings = await loadSettings();
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return;

  const endpoint = `${settings.supabaseUrl.replace(/\/$/, "")}/rest/v1/captures?id=eq.${encodeURIComponent(id)}`;

  const res = await fetch(endpoint, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "apikey": settings.supabaseAnonKey,
      "Authorization": `Bearer ${settings.supabaseAnonKey}`,
    },
    body: JSON.stringify({ deleted_at: new Date().toISOString() }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase soft-delete ${res.status}: ${text.slice(0, 100)}`);
  }
}

async function setSyncStatus(status) {
  await chrome.storage.local.set({ syncStatus: status });
}

// ─── Core: Capture Flow ────────────────────────────────────────────────────────

/**
 * Core capture flow.
 * Validates input, shows a toast, loads settings, classifies via LLM, stores the capture, and notifies the content script of success or error.
 */
async function handleSave(payload, sendResponse) {
  const { text, url, pageTitle } = payload;

  if (!text || text.trim().length === 0) {
    sendResponse({ success: false, error: "No text to save" });
    return;
  }

  try {
    // Notify content script to show "classifying" toast
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "SAVING" }).catch(() => {});
    }

    // Load settings and classify
    const settings = await loadSettings();
    const classified = await classify(text.trim(), url, pageTitle, settings);

    // Build capture object
    const capture = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      intent: classified.intent,
      title: classified.title,
      reason: classified.reason,
      extract: classified.extract,
      tags: classified.tags || [],
      rawText: text.trim().slice(0, 300),
      url,
      pageTitle,
      savedAt: new Date().toISOString(),
      intentMeta: INTENT_META[classified.intent] || INTENT_META.other,
    };

    await saveCapture(capture);

    // Sync to local Electron app (fire-and-forget)
    syncToLocal(capture);

    // Async Supabase sync — does not block capture or toast
    setSyncStatus("syncing").catch(() => {});
    syncToSupabase(capture)
      .then(() => setSyncStatus("synced"))
      .catch((err) => {
        console.warn("[Intent] Supabase sync failed:", err.message);
        setSyncStatus("error");
      });

    // Notify content script to show success toast
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "SAVE_CONFIRMED",
        capture,
      }).catch(() => {});
    }

    sendResponse({ success: true, capture });
  } catch (err) {
    console.error("[Intent] Save failed:", err);

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: "SAVE_ERROR",
        error: err.message,
      }).catch(() => {});
    }

    sendResponse({ success: false, error: err.message });
  }
}

// ─── Message Router ────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {

    case "SAVE_SELECTION":
      handleSave(message.payload, sendResponse);
      return true; // keep channel open for async response

    case "GET_CAPTURES":
      getCaptures().then((captures) => sendResponse({ captures }));
      return true;

    case "DELETE_CAPTURE":
      deleteCapture(message.payload.id).then(() => {
        softDeleteLocal(message.payload.id);
        softDeleteInSupabase(message.payload.id).catch((err) =>
          console.warn("[Intent] Supabase soft-delete failed:", err.message)
        );
        sendResponse({ success: true });
      });
      return true;

    case "ADD_TAG": {
      const { id: addId, tag: addTag } = message.payload;
      const normalized = addTag.trim().toLowerCase().slice(0, 32);
      if (normalized) {
        updateCapture(addId, (c) => {
          c.tags = c.tags || [];
          if (!c.tags.includes(normalized)) c.tags.push(normalized);
        }).then(async () => {
          const all = await getCaptures();
          const updated = all.find((c) => c.id === addId);
          if (updated) syncToLocal(updated);
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: true });
      }
      return true;
    }

    case "REMOVE_TAG": {
      const { id: removeId, tag: removeTag } = message.payload;
      updateCapture(removeId, (c) => {
        c.tags = (c.tags || []).filter((t) => t !== removeTag);
      }).then(async () => {
        const all = await getCaptures();
        const updated = all.find((c) => c.id === removeId);
        if (updated) syncToLocal(updated);
        sendResponse({ success: true });
      });
      return true;
    }

    case "RECLASSIFY_CAPTURE": {
      const { id: reclassId } = message.payload;
      (async () => {
        const all = await getCaptures();
        const cap = all.find((c) => c.id === reclassId);
        if (!cap) return sendResponse({ success: false, error: "Not found" });
        const settings = await loadSettings();
        const classified = await classify(
          cap.rawText || cap.title,
          cap.url,
          cap.pageTitle,
          settings
        );
        sendResponse({ success: true, classified });
      })().catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case "UPDATE_CAPTURE": {
      const { id: editId, fields } = message.payload;
      updateCapture(editId, (c) => {
        if (fields.title  !== undefined) c.title  = fields.title;
        if (fields.reason !== undefined) c.reason = fields.reason;
        if (fields.tags   !== undefined) c.tags   = fields.tags;
        if (fields.intent !== undefined) {
          c.intent     = fields.intent;
          c.intentMeta = INTENT_META[fields.intent] || INTENT_META.other;
        }
      }).then(async () => {
        const all = await getCaptures();
        const updated = all.find((c) => c.id === editId);
        if (updated) {
          syncToLocal(updated);
          syncToSupabase(updated).catch(() => {});
        }
        sendResponse({ success: true });
      });
      return true;
    }

    case "CLEAR_ALL":
      clearAllCaptures().then(() => sendResponse({ success: true }));
      return true;

    case "GET_SETTINGS":
      loadSettings().then((settings) => sendResponse({ settings }));
      return true;

    case "SAVE_SETTINGS":
      saveSettings(message.payload).then(() =>
        sendResponse({ success: true })
      );
      return true;

    default:
      sendResponse({ success: false, error: "Unknown message type" });
  }
});

// ─── Keyboard Shortcut ─────────────────────────────────────────────────────────

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "save-selection") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  const url = tab.url || "";
  const pageTitle = tab.title || "";

  try {
    // Ask the content script for the pre-cached selection (captured on selectionchange,
    // before the service worker woke up and any site handler could clear it).
    let text = "";
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: "GET_SELECTION" });
      text = res?.text || "";
    } catch {
      // Content script not reachable (restricted page) — fall through to page fallback.
    }

    if (!text) {
      text = `${pageTitle} — ${url}`;
    }

    handleSave({ text, url, pageTitle }, () => {});
  } catch (err) {
    console.error("[Intent] Shortcut failed:", err);
  }
});

// On every service worker startup, push all local captures to the Electron app.
// INSERT OR REPLACE makes this idempotent — safe to run every time.
replayCapturesToLocal();