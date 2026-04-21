const BASE = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY;

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "apikey": KEY,
    "Authorization": `Bearer ${KEY}`,
    ...extra,
  };
}

export function isConfigured() {
  return Boolean(BASE && KEY);
}

export async function fetchCaptures() {
  const res = await fetch(
    `${BASE}/rest/v1/captures?deleted_at=is.null&order=saved_at.desc`,
    { headers: headers() }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text().catch(() => "")}`);
  return res.json();
}

export async function patchCapture(id, data) {
  const res = await fetch(
    `${BASE}/rest/v1/captures?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", headers: headers(), body: JSON.stringify(data) }
  );
  if (!res.ok) throw new Error(`Supabase PATCH ${res.status}`);
}
