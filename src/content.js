/**
 * content.js — Content Script
 * Injected into every page. Only job: show toast notifications.
 * Never touches storage or LLM directly.
 */

// ─── Selection Pre-capture ─────────────────────────────────────────────────────
// Store the selection on change so background can retrieve it instantly on shortcut,
// avoiding the race where executeScript runs after the site clears the selection.

let lastSelection = "";
document.addEventListener("selectionchange", () => {
  const sel = window.getSelection();
  lastSelection = sel ? sel.toString().trim() : "";
});

// ─── Toast ─────────────────────────────────────────────────────────────────────

let activeToast = null;

function removeToast() {
  if (activeToast) {
    activeToast.style.opacity = "0";
    activeToast.style.transform = "translateY(8px)";
    setTimeout(() => {
      activeToast?.remove();
      activeToast = null;
    }, 250);
  }
}

function createToast() {
  removeToast();

  const toast = document.createElement("div");
  toast.id = "__intent-toast__";
  toast.style.cssText = `
    all: initial;
    position: fixed;
    bottom: 28px;
    right: 28px;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 11px 16px;
    background: #18181b;
    color: #fafafa;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.4;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.22), 0 1px 4px rgba(0,0,0,0.12);
    max-width: 320px;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.2s ease, transform 0.2s ease;
    pointer-events: none;
  `;

  document.documentElement.appendChild(toast);
  activeToast = toast;

  // Trigger enter animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });
  });

  return toast;
}

function showSavingToast() {
  const toast = createToast();

  // Spinner element
  const spinner = document.createElement("div");
  spinner.style.cssText = `
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    border-radius: 50%;
    flex-shrink: 0;
    animation: __intent-spin__ 0.6s linear infinite;
  `;

  // Inject keyframes once
  if (!document.getElementById("__intent-styles__")) {
    const style = document.createElement("style");
    style.id = "__intent-styles__";
    style.textContent = `
      @keyframes __intent-spin__ {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }

  const label = document.createElement("span");
  label.textContent = "Understanding intent…";

  toast.appendChild(spinner);
  toast.appendChild(label);
}

function showSuccessToast(capture) {
  const toast = createToast();

  const emoji = document.createElement("span");
  emoji.style.cssText = "font-size: 16px; flex-shrink: 0;";
  emoji.textContent = capture.intentMeta?.emoji || "📌";

  const body = document.createElement("div");
  body.style.cssText = "display: flex; flex-direction: column; gap: 2px;";

  const titleEl = document.createElement("span");
  titleEl.style.cssText = "color: #fafafa; font-weight: 600;";
  titleEl.textContent = truncate(capture.title, 48);

  const reasonEl = document.createElement("span");
  reasonEl.style.cssText = "color: #a1a1aa; font-size: 11.5px; font-weight: 400;";
  reasonEl.textContent = truncate(capture.reason, 72);

  body.appendChild(titleEl);
  body.appendChild(reasonEl);
  toast.appendChild(emoji);
  toast.appendChild(body);

  setTimeout(removeToast, 4000);
}

function showErrorToast(message) {
  const toast = createToast();
  toast.style.background = "#450a0a";

  const icon = document.createElement("span");
  icon.style.cssText = "font-size: 15px; flex-shrink: 0;";
  icon.textContent = "⚠️";

  const label = document.createElement("span");
  label.style.cssText = "color: #fca5a5;";
  label.textContent = truncate(message, 80);

  toast.appendChild(icon);
  toast.appendChild(label);

  setTimeout(removeToast, 5000);
}

function showInfoToast(message) {
  const toast = createToast();

  const icon = document.createElement("span");
  icon.style.cssText = "font-size: 15px; flex-shrink: 0;";
  icon.textContent = "💡";

  const label = document.createElement("span");
  label.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(label);

  setTimeout(removeToast, 3000);
}

// ─── Utils ─────────────────────────────────────────────────────────────────────

function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

// ─── Message Listener ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.type) {
    case "GET_SELECTION":
      sendResponse({ text: lastSelection });
      break;

    case "SAVING":
      showSavingToast();
      break;

    case "SAVE_CONFIRMED":
      showSuccessToast(message.capture);
      break;

    case "SAVE_ERROR":
      showErrorToast(message.error || "Could not save — check extension settings");
      break;

    case "INFO":
      showInfoToast(message.text);
      break;
  }
});