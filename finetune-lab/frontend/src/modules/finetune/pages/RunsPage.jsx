import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ListChecks, Plus, Trash2, Square, RefreshCw, Activity, CheckCircle2, Clock3 } from "lucide-react";
import { training } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { statusMeta, fmtTime, shortId, METHOD_LABEL, TERMINAL } from "../lib/format";
import { ConsoleSection, EmptyPanel, MetricCard, PageHero } from "../components/ConsolePage";

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
    } catch (err) {
      alert(err.message);
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

  const activeCount = runs.filter((r) => !TERMINAL.has(r.status)).length;
  const completedCount = runs.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-8">
      <PageHero
        title="Runs"
        description="Training history and live queue"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            {activeCount} active / {runs.length} total
          </span>
        }
        actions={
          <>
            <button onClick={load} className="neu-btn flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-neu-dim">
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={startNewRun} className="neu-btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold uppercase tracking-widest text-xs">
              <Plus size={16} /> New Run
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricCard icon={ListChecks} label="Tracked Runs" value={runs.length} hint="Persisted in local job store" />
        <MetricCard icon={Activity} label="Active" value={activeCount} hint="Queued, running, or stopping" accent />
        <MetricCard icon={CheckCircle2} label="Completed" value={completedCount} hint="Ready for export or reuse" />
      </div>

      <ConsoleSection
        title="All Runs"
        icon={Clock3}
        badge={loading ? "Syncing" : `${runs.length} entries`}
      >
        {loading ? (
          <p className="text-neu-dim text-sm py-10 text-center">Loading...</p>
        ) : runs.length === 0 ? (
          <EmptyPanel
            icon={ListChecks}
            title="No runs yet"
            description="Create a run to start filling the training queue."
            action={
              <button onClick={startNewRun} className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest">
                Start first run
              </button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="hidden xl:grid xl:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-4 text-[10px] font-mono text-neu-dim/60 uppercase tracking-widest">
              <span>Model</span>
              <span>Method</span>
              <span>Status</span>
              <span>Progress</span>
              <span className="text-right">Created</span>
            </div>
            {runs.map((r) => {
              const m = statusMeta(r.status);
              const active = !TERMINAL.has(r.status);
              return (
                <Link
                  key={r.job_id}
                  to={`/finetune/runs/${r.job_id}`}
                  className="neu-plate p-4 rounded-2xl no-underline group hover:-translate-y-0.5 transition-transform"
                >
                  <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-center">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`led ${m.led} shrink-0`} />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-neu-text truncate">{r.model_name || "—"}</div>
                        <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                          {shortId(r.job_id)}
                        </div>
                      </div>
                    </div>
                    <div className="text-[11px] font-mono uppercase tracking-widest text-neu-dim">
                      {METHOD_LABEL[r.training_type] || r.training_type}
                    </div>
                    <div>
                      <span className={`neu-badge ${m.cls}`}>{m.label}</span>
                    </div>
                    <div className="text-[11px] font-mono text-neu-dim uppercase tracking-widest">
                      {r.progress ?? 0}%{r.total_steps ? ` · ${r.step || 0}/${r.total_steps}` : ""}
                    </div>
                    <div className="flex items-center justify-between xl:justify-end gap-3">
                      <span className="text-[10px] font-mono text-neu-dim">{fmtTime(r.created_at)}</span>
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
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </ConsoleSection>
    </div>
  );
}
