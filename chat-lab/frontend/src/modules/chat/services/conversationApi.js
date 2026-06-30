const API_BASE = 'http://localhost:8100/api';

async function req(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `${path} failed (${res.status})`);
  }
  return res.status === 204 ? null : res.json();
}

export const conversationApi = {
  list: () => req('/conversations'),
  get: (id) => req(`/conversations/${id}`),
  save: (conv) =>
    req('/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conv),
    }),
  remove: (id) => req(`/conversations/${id}`, { method: 'DELETE' }),
  exportMarkdownUrl: (id) => `${API_BASE}/conversations/${id}/export.md`,
};
