import JSZip from "jszip";

// ─── Markdown Builder ─────────────────────────────────────────────────────────

export function captureToMarkdown(capture) {
  const lines = [];

  lines.push("---");
  lines.push(`title: "${yamlEsc(capture.title || "Untitled")}"`);
  lines.push(`intent: ${capture.intent || "other"}`);
  if (capture.url) lines.push(`url: "${capture.url}"`);
  if (capture.page_title) lines.push(`page_title: "${yamlEsc(capture.page_title)}"`);
  lines.push(`saved_at: ${capture.saved_at || new Date().toISOString()}`);
  const allTags = [`intent/${capture.intent || "other"}`, ...(capture.tags || [])];
  lines.push(`tags:`);
  allTags.forEach(t => lines.push(`  - ${t}`));
  lines.push("---");
  lines.push("");

  lines.push(`# ${capture.title || "Untitled"}`);
  lines.push("");

  if (capture.reason) {
    lines.push(`*${capture.reason}*`);
    lines.push("");
  }

  if (capture.distillation?.length) {
    lines.push("## Distillation");
    lines.push("");
    capture.distillation.forEach(b => lines.push(`- ${b}`));
    lines.push("");
  }

  if (capture.url) {
    lines.push("## Source");
    lines.push("");
    lines.push(`[${capture.page_title || capture.url}](${capture.url})`);
    lines.push("");
  }

  const body = capture.extract || capture.raw_text;
  if (body) {
    lines.push("---");
    lines.push("");
    lines.push(body);
  }

  return lines.join("\n");
}

// ─── Single Export ────────────────────────────────────────────────────────────

export function exportSingle(capture) {
  const md = captureToMarkdown(capture);
  triggerDownload(
    new Blob([md], { type: "text/markdown;charset=utf-8" }),
    `${safeFilename(capture.title)}.md`
  );
}

// ─── Bulk ZIP Export ──────────────────────────────────────────────────────────

export async function exportBulkZip(captures) {
  const zip = new JSZip();
  const used = new Set();

  captures.forEach(capture => {
    let base = safeFilename(capture.title);
    let name = `${base}.md`;
    let n = 1;
    while (used.has(name)) name = `${base}-${n++}.md`;
    used.add(name);
    zip.file(name, captureToMarkdown(capture));
  });

  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(blob, `intent-${new Date().toISOString().slice(0, 10)}.zip`);
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function safeFilename(title) {
  return (String(title || "untitled"))
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 60) || "capture";
}

function yamlEsc(str) {
  return String(str ?? "").replace(/"/g, '\\"');
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
