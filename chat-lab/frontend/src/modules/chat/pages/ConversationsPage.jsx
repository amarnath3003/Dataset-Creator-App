import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, MessageSquareText, Download, Trash2, ExternalLink, RefreshCw } from 'lucide-react';
import { useToast } from '../../../components/Toast';
import { conversationApi } from '../services/conversationApi';

export default function ConversationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Manual refresh (event handler) shows the spinner.
  const load = () => {
    setLoading(true);
    conversationApi.list().then(setItems).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };
  // Initial fetch sets state only in the async callback.
  useEffect(() => {
    conversationApi.list().then(setItems).catch(() => {});
  }, []);

  const open = async (id) => {
    try {
      const conv = await conversationApi.get(id);
      navigate('/chat', { state: { conversation: conv } });
    } catch (e) { toast.error(e.message); }
  };

  const remove = async (id) => {
    try { await conversationApi.remove(id); setItems((prev) => prev.filter((c) => c.id !== id)); toast.success('Deleted'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="neu-section max-w-4xl mx-auto !mb-0">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold text-sm">
          <Archive size={16} className="text-neu-dim" /> Saved Conversations
        </h2>
        <button className="neu-btn-sm" onClick={load}><RefreshCw size={12} className={loading ? 'animate-spin' : ''} /></button>
      </div>
      <div className="neu-section-body space-y-3">
        {items.length === 0 && (
          <div className="text-center text-neu-dim py-16">
            <MessageSquareText size={32} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">No saved conversations yet.</p>
            <p className="text-xs text-neu-dim/60 mt-1">Save a chat from the Chat tab and it'll show up here.</p>
          </div>
        )}
        {items.map((c) => (
          <div key={c.id} className="neu-chunk p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-neu-text font-semibold text-sm truncate">{c.title || 'Untitled'}</h3>
              <p className="text-[11px] text-neu-dim font-mono mt-0.5 truncate">
                {c.model_label || 'unknown model'} · {c.message_count} msgs · {c.updated_at}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button className="neu-btn-sm" onClick={() => open(c.id)} title="Open in Chat"><ExternalLink size={13} /> Open</button>
              <a className="neu-btn-sm no-underline" href={conversationApi.exportMarkdownUrl(c.id)} target="_blank" rel="noreferrer" title="Export Markdown"><Download size={13} /> .md</a>
              <button className="neu-btn-sm hover:!text-red-400" onClick={() => remove(c.id)} title="Delete"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
