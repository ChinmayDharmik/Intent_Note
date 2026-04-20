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
      rawText: text.trim().slice(0, 300),
      url,
      pageTitle,
      savedAt: new Date().toISOString(),
      intentMeta: INTENT_META[classified.intent] || INTENT_META.other,
    };

    await saveCapture(capture);

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
      deleteCapture(message.payload.id).then(() =>
        sendResponse({ success: true })
      );
      return true;

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

  try {
    // Inject a one-off script to grab the current selection
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        text: window.getSelection()?.toString().trim() || "",
        url: window.location.href,
        pageTitle: document.title,
      }),
    });

    const payload = results?.[0]?.result;
    if (!payload) return;

    // If no text selected, fall back to saving the page title + URL as an article
    if (!payload.text) {
      payload.text = `${payload.pageTitle} — ${payload.url}`;
    }

    handleSave(payload, () => {});
  } catch (err) {
    console.error("[Intent] Shortcut failed:", err);
  }
});