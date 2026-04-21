import { fetchCaptures, patchCapture, isConfigured } from "./supabase.js";
import { distill, loadSettings, saveSettings } from "./llm.js";
import { exportSingle, exportBulkZip } from "./export.js";
import {
  buildCard, buildDetailView, buildDistillHTML,
  buildSettingsPanel, buildNavItem,
} from "./render.js";

// ─── State ────────────────────────────────────────────────────────────────────

let captures     = [];
let activeFilter = "all";

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const mainEl       = document.getElementById("main");
const railNav      = document.getElementById("railNav");
const settingsBtn  = document.getElementById("settingsBtn");
const exportAllBtn = document.getElementById("exportAllBtn");
const errorEl      = document.getElementById("error");

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  if (!isConfigured()) {
    mainEl.innerHTML = `
      <div class="empty">
        <div class="empty-icon">◆</div>
        <p class="empty-title">Supabase not configured</p>
        <p class="empty-sub">
          Create <code>web/.env.local</code> with:<br>
          <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
        </p>
      </div>`;
    return;
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
}

function setFilter(filter) {
  activeFilter = filter;
  buildNav();
  renderGrid();
}

// ─── Grid ─────────────────────────────────────────────────────────────────────

function renderGrid() {
  const filtered = activeFilter === "all"
    ? captures
    : captures.filter(c => c.intent === activeFilter);

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
  filtered.forEach((capture, i) => grid.appendChild(buildCard(capture, i, openDetail)));

  mainEl.innerHTML = "";
  mainEl.appendChild(grid);
}

// ─── Detail ───────────────────────────────────────────────────────────────────

function openDetail(capture) {
  const el = buildDetailView(
    capture,
    renderGrid,
    (distillEl) => runDistillation(capture, distillEl),
    () => exportSingle(capture)
  );
  mainEl.innerHTML = "";
  mainEl.appendChild(el);
  mainEl.scrollTop = 0;
}

async function runDistillation(capture, distillEl) {
  try {
    const bullets = await distill(capture);

    if (!bullets || !bullets.length) {
      distillEl.innerHTML = `<p class="distill-hint">Could not parse distillation response.</p>`;
      return;
    }

    distillEl.innerHTML = buildDistillHTML(bullets);

    patchCapture(capture.id, { distillation: bullets }).catch(() => {});

    const idx = captures.findIndex(c => c.id === capture.id);
    if (idx !== -1) captures[idx] = { ...captures[idx], distillation: bullets };
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

// ─── Error ────────────────────────────────────────────────────────────────────

function showError(msg) {
  errorEl.textContent = "⚠ " + msg;
  errorEl.classList.remove("hidden");
}

boot();
