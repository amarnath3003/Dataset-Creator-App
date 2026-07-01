import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PackageOpen, Trash2, RefreshCw, Box, HardDrive, Cloud, FileArchive } from "lucide-react";
import { exports as exportApi } from "../services/finetuneApi";
import { fmtTime, shortId } from "../lib/format";

const KIND_META = {
  adapter: { label: "Adapter", icon: FileArchive },
  merged_16bit: { label: "Merged 16-bit", icon: Box },
  gguf: { label: "GGUF", icon: HardDrive },
  hub: { label: "HF Hub", icon: Cloud },
};

const EXPORT_TERMINAL = new Set(["completed", "failed"]);

export default function ExportsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const list = await exportApi.list();
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const onDelete = async (id) => {
    if (!window.confirm("Remove this export record?")) return;
    try {
      await exportApi.remove(id);
      setItems((prev) => prev.filter((e) => e.export_id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const badge = (status) => {
    if (status === "completed") return "neu-badge-green";
    if (status === "failed") return "neu-badge-red";
    return "neu-badge-accent";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-light text-neu-text tracking-tight">Exports</h1>
          <p className="text-neu-dim/60 font-mono text-[11px] uppercase tracking-[0.25em] mt-2">
            Merged models · GGUF · Hub pushes
          </p>
        </div>
        <button onClick={load} className="neu-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-neu-dim">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <PackageOpen size={18} className="text-neu-dim" /> Export Jobs
          </h2>
          <span className="text-[11px] font-mono text-neu-dim uppercase tracking-widest">{items.length}</span>
        </div>
        <div className="neu-section-body">
          {loading ? (
            <p className="text-neu-dim text-sm py-10 text-center">Loading…</p>
          ) : items.length === 0 ? (
            <div className="text-center py-14 space-y-3">
              <PackageOpen size={28} className="mx-auto text-neu-dim/40" />
              <p className="text-neu-dim text-sm">No exports yet.</p>
              <p className="text-neu-dim/60 text-xs">Finish a run, then export it from its Run page.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((e) => {
                const km = KIND_META[e.kind] || { label: e.kind, icon: Box };
                const KIcon = km.icon;
                return (
                  <div key={e.export_id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl neu-plate">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl neu-inset flex items-center justify-center text-neu-accent shrink-0">
                        <KIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-neu-text">{km.label}</div>
                        <div className="text-[10px] font-mono text-neu-dim truncate">
                          <Link to={`/finetune/runs/${e.run_id}`} className="text-neu-accent no-underline">run {shortId(e.run_id)}</Link>
                          {e.output_path ? ` · ${e.output_path}` : ""}
                        </div>
                        {e.error && <div className="text-[10px] text-red-400 mt-0.5 truncate">{e.error}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {!EXPORT_TERMINAL.has(e.status) && (
                        <span className="text-[10px] font-mono text-neu-dim">{e.progress ?? 0}%</span>
                      )}
                      <span className={`neu-badge ${badge(e.status)}`}>{e.status}</span>
                      <span className="text-[10px] font-mono text-neu-dim hidden md:block">{fmtTime(e.created_at)}</span>
                      {EXPORT_TERMINAL.has(e.status) && (
                        <button onClick={() => onDelete(e.export_id)} className="neu-btn-sm p-2 rounded-lg text-neu-dim hover:text-red-400" title="Remove">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
