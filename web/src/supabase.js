import { loadSettings } from "./llm.js";

// ─── Local (Electron) ─────────────────────────────────────────────────────────

export function isConfigured() {
  if (typeof window !== 'undefined' && window.electronBridge) return true;
  const { base, key } = getConfig();
  return Boolean(base && key);
}

export async function fetchCaptures() {
  if (typeof window !== 'undefined' && window.electronBridge) {
    return window.electronBridge.getCaptures();
  }
  return fetchFromSupabase();
}

export async function patchCapture(id, data) {
  if (typeof window !== 'undefined' && window.electronBridge) {
    return window.electronBridge.patchCapture(id, data);
  }
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
