import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ListChecks, Plus, Trash2, Square, RefreshCw } from "lucide-react";
import { training } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { statusMeta, fmtTime, shortId, METHOD_LABEL, TERMINAL } from "../lib/format";

export default function RunsPage() {
  const navigate = useNavigate();
  const { reset } = useWizard();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const r = await training.listRuns();
      setRuns(Array.isArray(r) ? r : []);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  const onStop = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(id);
    try {
      await training.stop(id);
      await load();
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Delete this run and its artifacts? This cannot be undone.")) return;
    setBusy(id);
    try {
      await training.remove(id);
      setRuns((prev) => prev.filter((r) => r.job_id !== id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(null);
    }
  };

  const startNewRun = () => {
    reset();
    navigate("/finetune/new/model");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-light text-neu-text tracking-tight">Runs</h1>
          <p className="text-neu-dim/60 font-mono text-[11px] uppercase tracking-[0.25em] mt-2">
            Training history
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="neu-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-neu-dim">
            <RefreshCw size={15} /> Refresh
          </button>
          <button onClick={startNewRun} className="neu-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs">
            <Plus size={16} /> New Run
          </button>
        </div>
      </div>

      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <ListChecks size={18} className="text-neu-dim" /> All Runs
          </h2>
          <span className="text-[11px] font-mono text-neu-dim uppercase tracking-widest">{runs.length} total</span>
        </div>
        <div className="neu-section-body">
          {loading ? (
            <p className="text-neu-dim text-sm py-10 text-center">Loading…</p>
          ) : runs.length === 0 ? (
            <div className="text-center py-14 space-y-4">
              <ListChecks size={28} className="mx-auto text-neu-dim/40" />
              <p className="text-neu-dim text-sm">No runs yet.</p>
              <button onClick={startNewRun} className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest">
                Start your first run
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* header row */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-4 text-[10px] font-mono text-neu-dim/60 uppercase tracking-widest">
                <span className="col-span-4">Model</span>
                <span className="col-span-2">Method</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2">Progress</span>
                <span className="col-span-2 text-right">Created</span>
              </div>
              {runs.map((r) => {
                const m = statusMeta(r.status);
                const active = !TERMINAL.has(r.status);
                return (
                  <Link
                    key={r.job_id}
                    to={`/finetune/runs/${r.job_id}`}
                    className="grid grid-cols-2 md:grid-cols-12 gap-4 items-center px-4 py-3 rounded-xl neu-plate no-underline group"
                  >
                    <div className="md:col-span-4 flex items-center gap-3 min-w-0">
                      <div className={`led ${m.led} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-neu-text truncate">{r.model_name || "—"}</div>
                        <div className="text-[10px] font-mono text-neu-dim">{shortId(r.job_id)}</div>
                      </div>
                    </div>
                    <div className="md:col-span-2 text-[11px] font-mono uppercase tracking-widest text-neu-dim">
                      {METHOD_LABEL[r.training_type] || r.training_type}
                    </div>
                    <div className="md:col-span-2">
                      <span className={`neu-badge ${m.cls}`}>{m.label}</span>
                    </div>
                    <div className="md:col-span-2 text-xs font-mono text-neu-dim">
                      {r.progress ?? 0}%{r.total_steps ? ` · ${r.step || 0}/${r.total_steps}` : ""}
                    </div>
                    <div className="md:col-span-2 flex items-center justify-end gap-2">
                      <span className="text-[10px] font-mono text-neu-dim hidden lg:block">{fmtTime(r.created_at)}</span>
                      {active ? (
                        <button
                          onClick={(e) => onStop(e, r.job_id)}
                          disabled={busy === r.job_id}
                          title="Stop run"
                          className="neu-btn-sm p-2 rounded-lg text-neu-dim hover:text-red-400"
                        >
                          <Square size={14} />
                        </button>
                      ) : (
                        <button
                          onClick={(e) => onDelete(e, r.job_id)}
                          disabled={busy === r.job_id}
                          title="Delete run"
                          className="neu-btn-sm p-2 rounded-lg text-neu-dim hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
