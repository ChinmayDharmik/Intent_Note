import { loadSettings } from "./llm.js";

const LOCAL_URL = "http://localhost:47832";

// ─── Local (Electron) ─────────────────────────────────────────────────────────

export function isConfigured() {
  // Always true — fetchCaptures tries all sources and throws only if all fail
  return true;
}

export async function fetchCaptures() {
  if (typeof window !== 'undefined' && window.electronBridge) {
    return window.electronBridge.getCaptures();
  }
  // Try local HTTP server (works when Electron desktop app is running alongside browser)
  try {
    const res = await fetch(`${LOCAL_URL}/captures`);
    if (res.ok) return res.json();
  } catch {}
  // Fall back to Supabase
  const { base, key } = getConfig();
  if (!base || !key) throw new Error("Open the desktop app, or add Supabase credentials in Settings (⚙).");
  return fetchFromSupabase();
}

export async function deleteCapture(id) {
  if (typeof window !== 'undefined' && window.electronBridge) {
    return window.electronBridge.deleteCapture(id);
  }
  try {
    const res = await fetch(`${LOCAL_URL}/captures/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
    if (res.ok) return;
  } catch {}
  return patchInSupabase(id, { deleted_at: new Date().toISOString() });
}

export async function patchCapture(id, data) {
  if (typeof window !== 'undefined' && window.electronBridge) {
    return window.electronBridge.patchCapture(id, data);
  }
  // Try local HTTP server first
  try {
    const res = await fetch(`${LOCAL_URL}/captures/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) return;
  } catch {}
  return patchInSupabase(id, data);
}

// ─── Supabase fallback ────────────────────────────────────────────────────────

function getConfig() {
  const s = loadSettings();
  return {
    base: s.supabaseUrl?.replace(/\/$/, "") || "",
    key:  s.supabaseAnonKey || "",
  };
}

function headers(extra = {}) {
  const { key } = getConfig();
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "apikey": key,
    "Authorization": `Bearer ${key}`,
    ...extra,
  };
}

async function fetchFromSupabase() {
  const { base } = getConfig();
  const res = await fetch(
    `${base}/rest/v1/captures?deleted_at=is.null&order=saved_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

async function patchInSupabase(id, data) {
  const { base } = getConfig();
  const res = await fetch(
    `${base}/rest/v1/captures?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", headers: headers(), body: JSON.stringify(data) }
  );
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text().catch(() => "")}`);
}
