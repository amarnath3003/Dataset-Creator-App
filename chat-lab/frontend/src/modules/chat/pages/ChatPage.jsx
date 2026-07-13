import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Send, Square, Save, Eraser, Settings2, Terminal, MessageSquareText } from "lucide-react";
import { Button } from "../../../components/Button";
import { useToast } from "../../../components/Toast";
import ModelPicker, { toTarget } from "../../../components/ModelPicker";
import GenerationControls, { DEFAULT_PARAMS } from "../../../components/GenerationControls";
import ChatMessage from "../../../components/ChatMessage";
import { PageHero, ConsoleSection, EmptyPanel } from "../../../components/ConsolePage";
import { streamChat, stopStream } from "../services/chatApi";
import { conversationApi } from "../services/conversationApi";

export default function ChatPage() {
  const toast = useToast();
  const location = useLocation();

  const [model, setModel] = useState(null);
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [params, setParams] = useState({ ...DEFAULT_PARAMS });
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [convId, setConvId] = useState(null);
  const [showSettings, setShowSettings] = useState(true);

  const streamIdRef = useRef(null);
  const abortRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    const incoming = location.state?.conversation;
    if (incoming) {
      setMessages(incoming.messages || []);
      setSystemPrompt(incoming.system_prompt || "");
      setParams({ ...DEFAULT_PARAMS, ...(incoming.params || {}) });
      setConvId(incoming.id || null);
      if (incoming.target) setModel(incoming.target);
    }
  }, [location.state]);

  useEffect(() => {
    const search = new URLSearchParams(location.search);
    if (search.has("fresh")) {
      setMessages([]);
      setConvId(null);
      setInput("");
    }
  }, [location.search]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const updateLastAssistant = (mutator) => {
    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === "assistant") {
          next[i] = mutator({ ...next[i] });
          break;
        }
      }
      return next;
    });
  };

  const runStream = async (history) => {
    if (!model) {
      toast.error("Pick a model first");
      return;
    }
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
        controller.signal
      );
    } catch (e) {
      if (e.name !== "AbortError") updateLastAssistant((m) => ({ ...m, error: e.message, streaming: false }));
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
    const history = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    setInput("");
    runStream(history);
  };

  const regenerate = () => {
    if (streaming) return;
    let cut = messages.length;
    while (cut > 0 && messages[cut - 1].role === "assistant") cut--;
    const history = messages.slice(0, cut);
    if (!history.length) return;
    setMessages([...history, { role: "assistant", content: "", streaming: true }]);
    runStream(history);
  };

  const stop = async () => {
    await stopStream(streamIdRef.current);
    abortRef.current?.abort();
    setStreaming(false);
  };

  const clear = () => {
    setMessages([]);
    setConvId(null);
  };

  const save = async () => {
    if (!messages.length) {
      toast.warn("Nothing to save");
      return;
    }
    try {
      const saved = await conversationApi.save({
        id: convId,
        target: model ? { ...model } : {},
        system_prompt: systemPrompt,
        params,
        messages: messages.map(({ role, content, stats }) => ({ role, content, stats })),
      });
      setConvId(saved.id);
      toast.success("Conversation saved");
    } catch (e) {
      toast.error(e.message);
    }
  };

  const copy = (text) => {
    navigator.clipboard?.writeText(text);
    toast.info("Copied");
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Chat"
        description="Interactive model console"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest uppercase">
            {model ? "target armed" : "awaiting target"}
          </span>
        }
        actions={
          <div className="neu-inset px-4 py-2 rounded-xl">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neu-dim">
              {convId ? "saved conversation" : "unsaved draft"} / {messages.length} turns
            </span>
          </div>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6">
        <ConsoleSection
          title="Live Session"
          icon={Terminal}
          badge={model ? model.label : "No model selected"}
          className="!mb-0"
          action={
            <div className="flex items-center gap-2">
              <button className="neu-btn-sm" onClick={save} title="Save conversation">
                <Save size={13} /> Save
              </button>
              <button className="neu-btn-sm" onClick={clear} title="Clear chat">
                <Eraser size={13} /> Clear
              </button>
            </div>
          }
        >
          <div className="flex h-[min(56vh,560px)] min-h-[360px] xl:h-[min(62vh,640px)] xl:min-h-[420px] flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-6 pr-1">
              {messages.length === 0 ? (
                <EmptyPanel
                  icon={MessageSquareText}
                  title="Start a new conversation"
                  description="Pick a target on the right, then send a prompt to inspect your fine-tuned run or compare it against a base model."
                />
              ) : (
                messages.map((m, i) => (
                  <ChatMessage
                    key={i}
                    message={m}
                    onCopy={copy}
                    onRegenerate={!m.streaming && m.role === "assistant" && i === messages.length - 1 ? regenerate : null}
                  />
                ))
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-white/5">
              <div className="neu-trough flex flex-col gap-3 p-2.5 sm:flex-row sm:items-end">
                <textarea
                  className="w-full flex-1 min-h-[52px] bg-transparent outline-none resize-none text-sm text-neu-text placeholder:text-neu-dim/40 px-3 py-3 max-h-40"
                  rows={2}
                  placeholder={model ? "Type a message... (Enter to send, Shift+Enter for newline)" : "Pick a model first..."}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                {streaming ? (
                  <Button variant="primary" className="w-full gap-2 sm:w-auto sm:min-w-[132px]" onClick={stop}>
                    <Square size={16} />
                    Stop
                  </Button>
                ) : (
                  <Button variant="primary" className="w-full gap-2 sm:w-auto sm:min-w-[132px]" onClick={send} disabled={!input.trim() || !model}>
                    <Send size={16} />
                    Send
                  </Button>
                )}
              </div>
            </div>
          </div>
        </ConsoleSection>

        <div className="space-y-6">
          <ConsoleSection title="Target & Prompt" icon={Settings2} badge="Loaded model, system prompt, and runtime defaults" className="!mb-0">
            <div className="space-y-5">
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
              <Button variant="outline" className="w-full" onClick={() => setShowSettings((s) => !s)}>
                {showSettings ? "Hide generation settings" : "Show generation settings"}
              </Button>
            </div>
          </ConsoleSection>

          {showSettings && <GenerationControls params={params} onChange={setParams} />}
        </div>
      </div>
    </div>
  );
}
