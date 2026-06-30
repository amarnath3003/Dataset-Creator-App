import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Square, Trash2, Save, Eraser, Settings2, Terminal } from 'lucide-react';
import { useToast } from '../../../components/Toast';
import ModelPicker, { toTarget } from '../../../components/ModelPicker';
import GenerationControls, { DEFAULT_PARAMS } from '../../../components/GenerationControls';
import ChatMessage from '../../../components/ChatMessage';
import { streamChat, stopStream } from '../services/chatApi';
import { conversationApi } from '../services/conversationApi';

export default function ChatPage() {
  const toast = useToast();
  const location = useLocation();

  const [model, setModel] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful assistant.');
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(null);
  const [showSettings, setShowSettings] = useState(true);

  const streamIdRef = useRef(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  // Open a saved conversation if navigated here with one.
  useEffect(() => {
    const incoming = location.state?.conversation;
    if (incoming) {
      setMessages(incoming.messages || []);
      setSystemPrompt(incoming.system_prompt || '');
      setParams({ ...DEFAULT_PARAMS, ...(incoming.params || {}) });
      setConvId(incoming.id || null);
      if (incoming.target) setModel(incoming.target);
    }
  }, [location.state]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const updateLastAssistant = (mutator) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') { next[i] = mutator({ ...next[i] }); break; }
      }
      return next;
    });
  };

  const runStream = async (history) => {
    if (!model) { toast.error('Pick a model first'); return; }
    setStreaming(true);
    const streamId = crypto.randomUUID();
    streamIdRef.current = streamId;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(
        {
          ...toTarget(model),
          system_prompt: systemPrompt,
          messages: history.map(({ role, content }) => ({ role, content })),
          params,
          stream_id: streamId,
        },
        {
          onToken: (text) => updateLastAssistant((m) => ({ ...m, content: m.content + text })),
          onDone: (evt) => updateLastAssistant((m) => ({ ...m, content: evt.text, stats: evt.stats, streaming: false })),
          onError: (msg) => updateLastAssistant((m) => ({ ...m, error: msg, streaming: false })),
        },
        controller.signal,
      );
    } catch (e) {
      if (e.name !== 'AbortError') updateLastAssistant((m) => ({ ...m, error: e.message, streaming: false }));
    } finally {
      setStreaming(false);
      streamIdRef.current = null;
      abortRef.current = null;
      updateLastAssistant((m) => ({ ...m, streaming: false }));
    }
  };

  const send = () => {
    const text = input.trim();
    if (!text || streaming) return;
    const history = [...messages, { role: 'user', content: text }];
    setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
    setInput('');
    runStream(history);
  };

  const regenerate = () => {
    if (streaming) return;
    // Drop trailing assistant turn, re-run from the last user message.
    let cut = messages.length;
    while (cut > 0 && messages[cut - 1].role === 'assistant') cut--;
    const history = messages.slice(0, cut);
    if (!history.length) return;
    setMessages([...history, { role: 'assistant', content: '', streaming: true }]);
    runStream(history);
  };

  const stop = async () => {
    await stopStream(streamIdRef.current);
    abortRef.current?.abort();
    setStreaming(false);
  };

  const clear = () => { setMessages([]); setConvId(null); };

  const save = async () => {
    if (!messages.length) { toast.warn('Nothing to save'); return; }
    try {
      const saved = await conversationApi.save({
        id: convId,
        target: model ? { ...model } : {},
        system_prompt: systemPrompt,
        params,
        messages: messages.map(({ role, content, stats }) => ({ role, content, stats })),
      });
      setConvId(saved.id);
      toast.success('Conversation saved');
    } catch (e) { toast.error(e.message); }
  };

  const copy = (text) => { navigator.clipboard?.writeText(text); toast.info('Copied'); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 h-[calc(100vh-140px)]">
      {/* Chat column */}
      <div className="neu-section flex flex-col overflow-hidden !mb-0">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold text-sm">
            <Terminal size={16} className="text-neu-dim" />
            {model ? model.label : 'No model loaded'}
          </h2>
          <div className="flex items-center gap-2">
            <button className="neu-btn-sm" onClick={save} title="Save conversation"><Save size={13} /> Save</button>
            <button className="neu-btn-sm" onClick={clear} title="Clear chat"><Eraser size={13} /> Clear</button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center text-neu-dim gap-3">
              <div className="w-16 h-16 rounded-2xl neu-plate flex items-center justify-center text-neu-accent">
                <Terminal size={28} />
              </div>
              <p className="text-sm">Select a model on the right and start chatting.</p>
              <p className="text-xs text-neu-dim/60 max-w-sm">Your fine-tuned runs from Finetune Lab appear automatically. You can also pick a base model to compare against.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              message={m}
              onCopy={copy}
              onRegenerate={!m.streaming && m.role === 'assistant' && i === messages.length - 1 ? regenerate : null}
            />
          ))}
        </div>

        {/* Composer */}
        <div className="p-4 border-t border-white/5">
          <div className="neu-trough flex items-end gap-3 p-2.5">
            <textarea
              className="flex-1 bg-transparent outline-none resize-none text-sm text-neu-text placeholder:text-neu-dim/40 px-3 py-2 max-h-40"
              rows={1}
              placeholder={model ? 'Type a message… (Enter to send, Shift+Enter for newline)' : 'Pick a model first…'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            {streaming ? (
              <button className="neu-btn-primary px-5 py-3" onClick={stop}><Square size={16} /> Stop</button>
            ) : (
              <button className="neu-btn-primary px-5 py-3 disabled:opacity-40" onClick={send} disabled={!input.trim() || !model}>
                <Send size={16} /> Send
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="overflow-y-auto pr-1 space-y-6">
        <div className="neu-section !mb-0">
          <div className="neu-section-header">
            <h2 className="flex items-center gap-2 text-neu-text font-bold text-sm">
              <Settings2 size={16} className="text-neu-dim" /> Model & Prompt
            </h2>
            <div className="led led-on"></div>
          </div>
          <div className="neu-section-body space-y-5">
            <ModelPicker value={model} onChange={setModel} />
            <div>
              <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">System Prompt</label>
              <textarea
                className="neu-textarea mt-2"
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant."
              />
            </div>
            <button className="neu-btn w-full py-2.5 text-xs" onClick={() => setShowSettings((s) => !s)}>
              {showSettings ? 'Hide' : 'Show'} generation settings
            </button>
          </div>
        </div>

        {showSettings && <GenerationControls params={params} onChange={setParams} />}
      </div>
    </div>
  );
}
