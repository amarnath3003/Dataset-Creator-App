const API_BASE = 'http://localhost:8100/api';

/**
 * Stream a chat completion over SSE.
 *
 * EventSource can't POST, so we POST with fetch and parse the `data: {...}\n\n`
 * frames off the response body stream ourselves. Returns the stream_id (once the
 * server announces it) so the caller can /stop it.
 *
 * Callbacks: onMeta({stream_id}), onReady({model}), onStart({prompt_tokens,...}),
 * onToken(text), onDone({text,stats}), onError(message).
 * Pass an AbortSignal to abort the fetch (also triggers server-side stop on disconnect).
 */
export async function streamChat(payload, handlers = {}, signal) {
  const { onMeta, onReady, onStart, onToken, onDone, onError } = handlers;

  const res = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const dispatch = (evt) => {
    switch (evt.type) {
      case 'meta': onMeta?.(evt); break;
      case 'ready': onReady?.(evt); break;
      case 'start': onStart?.(evt); break;
      case 'token': onToken?.(evt.text); break;
      case 'done': onDone?.(evt); break;
      case 'error': onError?.(evt.message || 'Unknown error'); break;
      default: break;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const line = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      try {
        dispatch(JSON.parse(json));
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

export async function stopStream(streamId) {
  if (!streamId) return;
  await fetch(`${API_BASE}/chat/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stream_id: streamId }),
  }).catch(() => {});
}

export async function compare(payload) {
  const res = await fetch(`${API_BASE}/chat/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || `Compare failed (${res.status})`);
  return data;
}
