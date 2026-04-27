import { fetchCaptures, patchCapture, deleteCapture } from "./supabase.js";
import { distill, reclassify, loadSettings, saveSettings } from "./llm.js";
import { exportSingle, exportBulkZip } from "./export.js";
import {
  buildCard, buildDetailView, buildDistillHTML,
  buildSettingsPanel, buildInstallOverlay, buildNavItem,
} from "./render.js";

// ─── State ────────────────────────────────────────────────────────────────────

let captures     = [];
let activeFilter = "all";
let activeTag    = null;

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const mainEl        = document.getElementById("main");
const railNav       = document.getElementById("railNav");
const settingsBtn   = document.getElementById("settingsBtn");
const exportAllBtn  = document.getElementById("exportAllBtn");
const installExtBtn = document.getElementById("installExtBtn");
const errorEl       = document.getElementById("error");

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  if (window.electronBridge) {
    installExtBtn.style.display = "";
    const current = loadSettings();
    if (!current.supabaseUrl) {
      const stored = await window.electronBridge.getInitialSettings();
      if (stored?.supabaseUrl) {
        saveSettings({ ...current, supabaseUrl: stored.supabaseUrl, supabaseAnonKey: stored.supabaseAnonKey || "" });
      }
    }
    window.electronBridge.onSettingsFromExtension((data) => {
      const s = loadSettings();
      saveSettings({ ...s, supabaseUrl: data.supabaseUrl || s.supabaseUrl, supabaseAnonKey: data.supabaseAnonKey || s.supabaseAnonKey });
    });
    window.electronBridge.onCapturesUpdated(async () => {
      captures = await fetchCaptures();
      buildNav();
      renderGrid();
    });
  } else {
    // Poll every 5 s when running in a browser alongside the desktop app
    setInterval(async () => {
      try {
        const fresh = await fetchCaptures();
        if (fresh.length !== captures.length) {
          captures = fresh;
          buildNav();
          renderGrid();
        }
      } catch {}
    }, 5000);
  }

  try {
    captures = await fetchCaptures();
  } catch (err) {
    showError("Could not load captures: " + err.message);
    captures = [];
  }

  buildNav();
  renderGrid();
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const INTENT_LABELS = {
  book:    "📚 Books",
  movie:   "🎬 Movies",
  article: "📰 Articles",
  idea:    "💡 Ideas",
  quote:   "💬 Quotes",
  product: "🛍️ Products",
  recipe:  "🍳 Recipes",
};

function buildNav() {
  railNav.innerHTML = "";

  const counts = {};
  captures.forEach(c => { counts[c.intent] = (counts[c.intent] || 0) + 1; });

  railNav.appendChild(
    buildNavItem("All saves", "all", captures.length, activeFilter === "all", setFilter)
  );

  Object.entries(INTENT_LABELS).forEach(([intent, label]) => {
    if (!counts[intent]) return;
    railNav.appendChild(
      buildNavItem(label, intent, counts[intent], activeFilter === intent, setFilter)
    );
  });

  // Tag cloud
  const tagCounts = {};
  captures.forEach(c => (c.tags || []).forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const tags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
  if (tags.length) {
    const divider = document.createElement("div");
    divider.className = "nav-tag-divider";
    divider.textContent = "Tags";
    railNav.appendChild(divider);

    const cloud = document.createElement("div");
    cloud.className = "nav-tag-cloud";
    tags.forEach(([tag]) => {
      const chip = document.createElement("button");
      chip.className = "nav-tag-chip" + (activeTag === tag ? " active" : "");
      chip.textContent = tag;
      chip.addEventListener("click", () => setTagFilter(tag));
      cloud.appendChild(chip);
    });
    railNav.appendChild(cloud);
  }
}

function setFilter(filter) {
  activeFilter = filter;
  buildNav();
  renderGrid();
}

function setTagFilter(tag) {
  activeTag = activeTag === tag ? null : tag;
  buildNav();
  renderGrid();
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function renderGrid() {
  let filtered = activeFilter === "all"
    ? captures
    : captures.filter(c => c.intent === activeFilter);

  if (activeTag) {
    filtered = filtered.filter(c => (c.tags || []).includes(activeTag));
  }

  if (filtered.length === 0) {
    mainEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◆</div>
        <p class="empty-title">Nothing here yet</p>
        <p class="empty-sub">Captures will appear once synced from the extension.</p>
      </div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "grid";
  filtered.forEach((capture, i) => grid.appendChild(buildCard(capture, i, openDetail, setTagFilter)));

  mainEl.innerHTML = "";
  mainEl.appendChild(grid);
}

// ─── Detail ───────────────────────────────────────────────────────────────────

function openDetail(capture) {
  const el = buildDetailView(
    capture,
    renderGrid,
    (distillEl) => runDistillation(capture, distillEl),
    () => exportSingle(capture),
    (id, fields) => handleEdit(id, fields),
    (cap) => reclassify(cap),
    (id) => handleDelete(id),
  );
  mainEl.innerHTML = "";
  mainEl.appendChild(el);
  mainEl.scrollTop = 0;
}

async function handleDelete(captureId) {
  await deleteCapture(captureId);
  captures = captures.filter(c => c.id !== captureId);
  buildNav();
  renderGrid();
}

async function handleEdit(captureId, fields) {
  await patchCapture(captureId, fields);
  const idx = captures.findIndex((c) => c.id === captureId);
  if (idx !== -1) {
    captures[idx] = { ...captures[idx], ...fields };
    openDetail(captures[idx]);
  }
}

async function runDistillation(capture, distillEl) {
  try {
    if (capture.distillation?.length) {
      distillEl.innerHTML = buildDistillHTML(capture.distillation);
      return;
    }

    const bullets = await distill(capture);

    if (!bullets || !bullets.length) {
      distillEl.innerHTML = `<p class="distill-hint">Could not parse distillation response.</p>`;
      return;
    }

    distillEl.innerHTML = buildDistillHTML(bullets);

    capture.distillation = bullets;
    const idx = captures.findIndex(c => c.id === capture.id);
    if (idx !== -1) captures[idx].distillation = bullets;

    patchCapture(capture.id, { distillation: bullets }).catch(() => {});
  } catch (err) {
    distillEl.innerHTML = `<p class="distill-hint">${err.message.includes("not configured")
      ? "Configure LLM provider in Settings (⚙) to enable distillation."
      : "Distillation failed: " + err.message}</p>`;
  }
}

// ─── Settings ─────────────────────────────────────────────────────────────────

exportAllBtn.addEventListener("click", async () => {
  const visible = activeFilter === "all"
    ? captures
    : captures.filter(c => c.intent === activeFilter);
  if (!visible.length) return;
  exportAllBtn.style.opacity = "0.4";
  exportAllBtn.style.pointerEvents = "none";
  try {
    await exportBulkZip(visible);
  } finally {
    exportAllBtn.style.opacity = "";
    exportAllBtn.style.pointerEvents = "";
  }
});

settingsBtn.addEventListener("click", () => {
  const panel = buildSettingsPanel(
    loadSettings(),
    (newSettings) => saveSettings(newSettings),
    () => panel.remove()
  );
  document.body.appendChild(panel);
});

installExtBtn.addEventListener("click", () => {
  const overlay = buildInstallOverlay(() => overlay.remove());
  document.body.appendChild(overlay);
});

// ─── Error ────────────────────────────────────────────────────────────────────

function showError(msg) {
  errorEl.textContent = "⚠ " + msg;
  errorEl.classList.remove("hidden");
}

boot();
