import React from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Bot, Copy, RotateCcw, Gauge, Timer, Hash } from 'lucide-react';

function Stat({ icon: Icon, value, title }) {
  if (value == null) return null;
  return (
    <span className="flex items-center gap-1" title={title}>
      <Icon size={11} />{value}
    </span>
  );
}

export default function ChatMessage({ message, onRegenerate, onCopy }) {
  const isUser = message.role === 'user';
  const stats = message.stats;

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isUser ? 'neu-trough text-neu-dim' : 'neu-plate text-neu-accent'}`}>
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>

      <div className={`flex flex-col gap-1.5 max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-5 py-3.5 rounded-2xl ${isUser ? 'neu-trough text-neu-text' : 'neu-plate'} ${message.streaming ? 'border border-neu-accent/20' : ''}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose-chat text-sm leading-relaxed">
              {message.content
                ? <ReactMarkdown>{message.content}</ReactMarkdown>
                : <span className="text-neu-dim italic flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-neu-accent animate-pulse" />
                    thinking…
                  </span>}
              {message.streaming && message.content && (
                <span className="inline-block w-2 h-4 align-middle bg-neu-accent/70 animate-pulse ml-0.5" />
              )}
            </div>
          )}
        </div>

        {message.error && (
          <span className="text-[11px] text-red-400 font-mono px-1">⚠ {message.error}</span>
        )}

        {!isUser && !message.streaming && (message.content || stats) && (
          <div className="flex items-center gap-3 text-[10px] text-neu-dim font-mono px-1">
            {stats && (
              <>
                <Stat icon={Hash} value={stats.completion_tokens != null ? `${stats.completion_tokens} tok` : null} title="completion tokens" />
                <Stat icon={Gauge} value={stats.tokens_per_second != null ? `${stats.tokens_per_second} tok/s` : null} title="tokens per second" />
                <Stat icon={Timer} value={stats.time_to_first_token_s != null ? `${stats.time_to_first_token_s}s TTFT` : null} title="time to first token" />
                {stats.stopped && <span className="text-neu-warning">stopped</span>}
                {stats.dropped_turns > 0 && <span title="oldest turns dropped to fit context">↺{stats.dropped_turns}</span>}
              </>
            )}
            <button onClick={() => onCopy?.(message.content)} className="hover:text-neu-text transition-colors" title="Copy">
              <Copy size={11} />
            </button>
            {onRegenerate && (
              <button onClick={onRegenerate} className="hover:text-neu-accent transition-colors" title="Regenerate">
                <RotateCcw size={11} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
