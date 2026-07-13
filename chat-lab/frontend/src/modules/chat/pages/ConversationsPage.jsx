import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Archive, MessageSquareText, Download, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "../../../components/Toast";
import { PageHero, ConsoleSection, EmptyPanel } from "../../../components/ConsolePage";
import { conversationApi } from "../services/conversationApi";

export default function ConversationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    conversationApi.list().then(setItems).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => {
    conversationApi.list().then(setItems).catch(() => {});
  }, []);

  const open = async (id) => {
    try {
      const conv = await conversationApi.get(id);
      navigate("/chat", { state: { conversation: conv } });
    } catch (e) {
      toast.error(e.message);
    }
  };

  const remove = async (id) => {
    try {
      await conversationApi.remove(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <PageHero
        title="Conversations"
        description="Saved sessions, markdown exports, and re-openable chat drafts"
        badge={<span className="font-mono text-xs text-neu-accent tracking-widest uppercase">{items.length} stored sessions</span>}
      />

      <ConsoleSection
        title="Saved Conversations"
        icon={Archive}
        badge="Conversation archive and export controls"
        className="!mb-0"
        action={
          <button className="neu-btn-sm" onClick={load} title="Refresh list">
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          </button>
        }
      >
        {items.length === 0 ? (
          <EmptyPanel
            icon={MessageSquareText}
            title="No saved conversations yet"
            description="Save a chat from the Chat page and it will appear here with reopen and export actions."
          />
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <div key={c.id} className="console-select-card rounded-[22px] p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="text-neu-text font-semibold text-sm truncate">{c.title || "Untitled"}</h3>
                  <p className="text-[11px] text-neu-dim font-mono mt-0.5 truncate">
                    {c.model_label || "unknown model"} - {c.message_count} msgs - {c.updated_at}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button className="neu-btn-sm" onClick={() => open(c.id)} title="Open in chat">
                    <ExternalLink size={13} /> Open
                  </button>
                  <a className="neu-btn-sm no-underline" href={conversationApi.exportMarkdownUrl(c.id)} target="_blank" rel="noreferrer" title="Export Markdown">
                    <Download size={13} /> .md
                  </a>
                  <button className="neu-btn-sm hover:!text-red-400" onClick={() => remove(c.id)} title="Delete">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ConsoleSection>
    </div>
  );
}
