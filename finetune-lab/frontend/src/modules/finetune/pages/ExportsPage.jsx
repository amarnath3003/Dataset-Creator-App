import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { PackageOpen, Trash2, RefreshCw, Box, HardDrive, Cloud, FileArchive, CheckCircle2 } from "lucide-react";
import { exports as exportApi } from "../services/finetuneApi";
import { fmtTime, shortId } from "../lib/format";
import { ConsoleSection, EmptyPanel, MetricCard, PageHero } from "../components/ConsolePage";

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

  const completedCount = items.filter((item) => item.status === "completed").length;

  return (
    <div className="space-y-8">
      <PageHero
        title="Exports"
        description="Merged models, GGUF builds, and Hub pushes"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            {completedCount} complete / {items.length} total
          </span>
        }
        actions={
          <button onClick={load} className="neu-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-neu-dim">
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricCard icon={PackageOpen} label="Export Jobs" value={items.length} hint="All artifact requests" />
        <MetricCard icon={CheckCircle2} label="Completed" value={completedCount} hint="Ready outputs" accent />
        <MetricCard icon={Cloud} label="Hub Pushes" value={items.filter((item) => item.kind === "hub").length} hint="Remote releases tracked" />
      </div>

      <ConsoleSection title="Export Jobs" icon={PackageOpen} badge={loading ? "Polling jobs" : `${items.length} entries`}>
        {loading ? (
          <p className="text-neu-dim text-sm py-10 text-center">Loading...</p>
        ) : items.length === 0 ? (
          <EmptyPanel
            icon={PackageOpen}
            title="No exports yet"
            description="Finish a run, then export it from the run detail page."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {items.map((e) => {
              const km = KIND_META[e.kind] || { label: e.kind, icon: Box };
              const KIcon = km.icon;
              return (
                <div key={e.export_id} className="neu-plate p-4 rounded-2xl">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center text-neu-accent shrink-0">
                        <KIcon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-neu-text">{km.label}</div>
                        <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1 truncate">
                          <Link to={`/finetune/runs/${e.run_id}`} className="text-neu-accent no-underline">
                            run {shortId(e.run_id)}
                          </Link>
                          {e.output_path ? ` · ${e.output_path}` : ""}
                        </div>
                        {e.error && <div className="text-[10px] text-red-400 mt-1 truncate">{e.error}</div>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                      {!EXPORT_TERMINAL.has(e.status) && (
                        <span className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">{e.progress ?? 0}%</span>
                      )}
                      <span className={`neu-badge ${badge(e.status)}`}>{e.status}</span>
                      <span className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">{fmtTime(e.created_at)}</span>
                      {EXPORT_TERMINAL.has(e.status) && (
                        <button onClick={() => onDelete(e.export_id)} className="neu-btn-sm p-2 rounded-lg text-neu-dim hover:text-red-400" title="Remove">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ConsoleSection>
    </div>
  );
}
