import { loadSettings } from "./llm.js";

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

export function isConfigured() {
  const { base, key } = getConfig();
  return Boolean(base && key);
}

export async function fetchCaptures() {
  const { base } = getConfig();
  const res = await fetch(
    `${base}/rest/v1/captures?select=id,intent,title,reason,extract,tags,saved_at,url,page_title,distillation&deleted_at=is.null&order=saved_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export async function patchCapture(id, data) {
  const { base } = getConfig();
  const res = await fetch(
    `${base}/rest/v1/captures?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", headers: headers(), body: JSON.stringify(data) }
  );
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}: ${await res.text().catch(() => "")}`);
}
