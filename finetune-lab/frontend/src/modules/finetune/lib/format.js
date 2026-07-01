// Small presentational helpers shared across studio pages.

export const TERMINAL = new Set(["completed", "failed", "cancelled"]);

export function statusMeta(status) {
  switch (status) {
    case "running":
      return { label: "Running", cls: "neu-badge-accent", led: "led-green animate-pulse", text: "text-neu-accent" };
    case "cancelling":
      return { label: "Stopping", cls: "neu-badge-accent", led: "led-red animate-pulse", text: "text-neu-accent" };
    case "completed":
      return { label: "Completed", cls: "neu-badge-green", led: "led-green", text: "text-green-500" };
    case "failed":
      return { label: "Failed", cls: "neu-badge-red", led: "led-red", text: "text-red-500" };
    case "cancelled":
      return { label: "Cancelled", cls: "neu-badge-red", led: "led-off", text: "text-red-400" };
    case "queued":
    default:
      return { label: "Queued", cls: "neu-badge-accent", led: "led-on", text: "text-neu-dim" };
  }
}

export function fmtEta(seconds) {
  if (seconds == null) return "—";
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtVram(mb) {
  if (!mb) return "0 GB";
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

export function shortId(id) {
  return String(id || "").split("-")[0] || String(id || "");
}

export const METHOD_LABEL = {
  sft: "SFT",
  lora: "LoRA",
  qlora: "QLoRA",
  cpt: "CPT",
  full: "Full",
  vision: "Vision",
};
