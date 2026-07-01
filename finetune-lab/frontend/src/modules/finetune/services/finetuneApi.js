// Unified Finetune Lab API client.
// Single source of truth for every backend call the studio makes. The older
// per-domain service files (modelApi/datasetApi/hardwareApi/trainingApi) now
// re-export from here so existing imports keep working.

const API = (import.meta.env.VITE_API_URL || "http://localhost:8000") + "/api";

async function req(path, { method = "GET", body, form, signal } = {}) {
  const opts = { method, signal, headers: {} };
  if (form) {
    opts.body = form; // browser sets multipart boundary
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.detail || detail;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const models = {
  list: () => req("/models/"),
  get: (id) => req(`/models/${encodeURIComponent(id)}`),
};

export const datasets = {
  list: () => req("/datasets/").then((d) => d.datasets || []),
  upload: (file) => {
    const form = new FormData();
    form.append("file", file);
    return req("/datasets/upload", { method: "POST", form });
  },
  validate: (path) => req("/datasets/validate", { method: "POST", body: { path } }),
};

export const hardware = {
  gpus: () => req("/hardware/gpus"),
};

export const training = {
  create: (payload) => req("/training/create", { method: "POST", body: payload }),
  status: (id) => req(`/training/status/${id}`),
  listRuns: () => req("/training/runs"),
  getRun: (id) => req(`/training/runs/${id}`),
  stop: (id) => req(`/training/stop/${id}`, { method: "POST" }),
  remove: (id) => req(`/training/runs/${id}`, { method: "DELETE" }),
  checkpoints: (id) => req(`/training/runs/${id}/checkpoints`),
};

export const exports = {
  create: (payload) => req("/export/create", { method: "POST", body: payload }),
  status: (id) => req(`/export/status/${id}`),
  forRun: (runId) => req(`/export/run/${runId}`),
  list: () => req("/export/list"),
  remove: (id) => req(`/export/${id}`, { method: "DELETE" }),
};

export default { models, datasets, hardware, training, exports };
