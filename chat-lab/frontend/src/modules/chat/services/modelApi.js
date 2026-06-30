const API_BASE = 'http://localhost:8100/api';

async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `POST ${path} failed (${res.status})`);
  return data;
}

export const modelApi = {
  getFinetuned: () => getJson('/models/finetuned'),
  getBase: () => getJson('/models/base'),
  getStatus: () => getJson('/models/status'),
  load: (target) => postJson('/models/load', target),
  unload: (target) => postJson('/models/unload', target || {}),
};
