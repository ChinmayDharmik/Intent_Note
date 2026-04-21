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

// ─── Card ─────────────────────────────────────────────────────────────────────

export function buildCard(capture, index, onClick) {
  const card = document.createElement("article");
  card.className = "card";
  card.dataset.id = capture.id;
  if (index % 5 === 0) card.classList.add("card--featured");
  card.style.animationDelay = `${Math.min(index, 10) * 35}ms`;

  const meta = INTENT_META[capture.intent] || INTENT_META.other;

  card.innerHTML = `
    <div class="card-inner">
      <div class="card-top">
        <span class="card-emoji">${meta.emoji}</span>
        <span class="card-badge">${esc(meta.label)}</span>
      </div>
      <h3 class="card-title">${esc(capture.title || "Untitled")}</h3>
      ${capture.reason ? `<p class="card-reason">${esc(capture.reason)}</p>` : ""}
      <div class="card-footer">
        <span class="card-time">${formatTime(capture.saved_at)}</span>
        ${capture.url ? `<span class="card-link-dot" title="Has source">◆</span>` : ""}
      </div>
    </div>
  `;

  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    card.style.setProperty("--glow-x", ((e.clientX - r.left) / r.width * 100) + "%");
    card.style.setProperty("--glow-y", ((e.clientY - r.top) / r.height * 100) + "%");
  });

  card.addEventListener("click", () => onClick(capture));
  return card;
}

// ─── Detail View ──────────────────────────────────────────────────────────────

export function buildDetailView(capture, onBack, onDistill, onExport) {
  const meta = INTENT_META[capture.intent] || INTENT_META.other;
  const el = document.createElement("div");
  el.className = "detail";

  const safeUrl = isSafeUrl(capture.url) ? capture.url : null;

  el.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">← Back</button>
      ${onExport ? `<button class="export-md-btn" id="exportMdBtn">↓ Export .md</button>` : ""}
    </div>
    <div class="detail-content">
      <div class="detail-meta">
        <span class="card-emoji">${meta.emoji}</span>
        <span class="card-badge">${esc(meta.label)}</span>
        <span class="detail-time">${formatTime(capture.saved_at)}</span>
      </div>
      <h1 class="detail-title">${esc(capture.title || "Untitled")}</h1>
      ${capture.reason ? `<p class="detail-reason">${esc(capture.reason)}</p>` : ""}
      ${safeUrl ? `<a class="detail-source" href="${escAttr(safeUrl)}" target="_blank" rel="noopener noreferrer">${esc(capture.page_title || safeUrl)}</a>` : ""}
    </div>
  `;

  el.querySelector("#backBtn").addEventListener("click", onBack);
  if (onExport) el.querySelector("#exportMdBtn").addEventListener("click", onExport);

  const distillSection = document.createElement("div");
  distillSection.className = "detail-distill";

  if (capture.distillation && Array.isArray(capture.distillation) && capture.distillation.length) {
    distillSection.innerHTML = buildDistillHTML(capture.distillation);
  } else {
    distillSection.innerHTML = `
      <div class="distill-loading">
        <span class="distill-spinner"></span>
        <span>Distilling…</span>
      </div>`;
    onDistill(distillSection);
  }

  el.appendChild(distillSection);

  if (capture.raw_text || capture.extract) {
    const body = document.createElement("div");
    body.className = "detail-body";
    body.innerHTML = `<p class="detail-raw">${esc(capture.extract || capture.raw_text)}</p>`;
    el.appendChild(body);
  }

  return el;
}

export function buildDistillHTML(bullets) {
  return `
    <h4 class="distill-label">Distillation</h4>
    <ul class="distill-list">
      ${bullets.map(b => `<li>${esc(b)}</li>`).join("")}
    </ul>
  `;
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

export function buildSettingsPanel(settings, onSave, onClose) {
  const el = document.createElement("div");
  el.className = "settings-overlay";

  el.innerHTML = `
    <div class="settings-panel">
      <div class="settings-header">
        <h2 class="settings-title">LLM Settings</h2>
        <button class="icon-btn" id="settingsClose">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="settings-body">
        <div class="field">
          <label class="field-label">Provider</label>
          <div class="radio-group">
            <label class="radio-label">
              <input type="radio" name="provider" value="anthropic" ${settings.provider === "anthropic" ? "checked" : ""} />
              Anthropic
            </label>
            <label class="radio-label">
              <input type="radio" name="provider" value="lmstudio" ${settings.provider === "lmstudio" ? "checked" : ""} />
              LM Studio
            </label>
          </div>
        </div>
        <div class="field" id="anthropicFields" ${settings.provider !== "anthropic" ? 'style="display:none"' : ""}>
          <label class="field-label">API Key</label>
          <input type="password" id="anthropicApiKey" class="input" value="${escAttr(settings.anthropicApiKey)}" placeholder="sk-ant-…" autocomplete="off" />
        </div>
        <div class="field" id="lmstudioFields" ${settings.provider !== "lmstudio" ? 'style="display:none"' : ""}>
          <label class="field-label">Base URL</label>
          <input type="text" id="lmstudioBaseUrl" class="input" value="${escAttr(settings.lmstudioBaseUrl)}" />
          <label class="field-label" style="margin-top:12px">Model</label>
          <input type="text" id="lmstudioModel" class="input" value="${escAttr(settings.lmstudioModel)}" />
        </div>
      </div>
      <div class="settings-footer">
        <button class="save-btn-wide" id="settingsSave">Save</button>
      </div>
    </div>
  `;

  el.querySelector("#settingsClose").addEventListener("click", onClose);
  el.addEventListener("click", (e) => { if (e.target === el) onClose(); });

  el.querySelectorAll("input[name=provider]").forEach(r => {
    r.addEventListener("change", () => {
      el.querySelector("#anthropicFields").style.display = r.value === "anthropic" ? "" : "none";
      el.querySelector("#lmstudioFields").style.display = r.value === "lmstudio" ? "" : "none";
    });
  });

  el.querySelector("#settingsSave").addEventListener("click", () => {
    const provider = el.querySelector("input[name=provider]:checked").value;
    onSave({
      provider,
      anthropicApiKey: el.querySelector("#anthropicApiKey").value.trim(),
      lmstudioBaseUrl: el.querySelector("#lmstudioBaseUrl").value.trim(),
      lmstudioModel:   el.querySelector("#lmstudioModel").value.trim(),
    });
    onClose();
  });

  return el;
}

// ─── Nav Item ─────────────────────────────────────────────────────────────────

export function buildNavItem(label, filter, count, isActive, onClick) {
  const btn = document.createElement("button");
  btn.className = "nav-item" + (isActive ? " active" : "");
  btn.dataset.filter = filter;
  btn.innerHTML = `${esc(label)}${count > 0 ? `<span class="nav-badge">${count}</span>` : ""}`;
  btn.addEventListener("click", () => onClick(filter));
  return btn;
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

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

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
