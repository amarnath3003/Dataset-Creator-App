import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Activity, CheckCircle2, Cpu, ArrowRight, Layers, Zap, WifiOff } from "lucide-react";
import { training, hardware } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { statusMeta, fmtTime, shortId, METHOD_LABEL } from "../lib/format";
import { ConsoleSection, EmptyPanel, MetricCard, PageHero } from "../components/ConsolePage";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { reset } = useWizard();
  const [runs, setRuns] = useState([]);
  const [gpus, setGpus] = useState(null);
  const [hwError, setHwError] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [r, g] = await Promise.all([
        training.listRuns().catch(() => []),
        hardware.gpus().catch((err) => ({ __unreachable: err?.message || "Backend unreachable" })),
      ]);
      setRuns(Array.isArray(r) ? r : []);
      if (g?.__unreachable) {
        setGpus(null);
        setHwError(g.__unreachable);
      } else {
        setGpus(g);
        setHwError(g?.error || null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const startNewRun = () => {
    reset();
    navigate("/finetune/new/model");
  };

  const counts = {
    total: runs.length,
    running: runs.filter((r) => ["running", "queued", "cancelling"].includes(r.status)).length,
    completed: runs.filter((r) => r.status === "completed").length,
    detectedGpuCount: hwError ? "—" : gpus ? gpus.count ?? 0 : "—",
  };
  const recent = runs.slice(0, 5);

  return (
    <div className="space-y-8">
      <PageHero
        title="Dashboard"
        description="Local fine-tuning studio"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            {counts.running} active / {counts.total} total
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard icon={Layers} label="Total Runs" value={counts.total} hint="All jobs recorded locally" />
        <MetricCard icon={Activity} label="Active" value={counts.running} hint="Queued, running, or stopping" accent />
        <MetricCard icon={CheckCircle2} label="Completed" value={counts.completed} hint="Successful training runs" />
        <MetricCard
          icon={Cpu}
          label="GPUs Detected"
          value={counts.detectedGpuCount}
          hint={hwError ? "Backend unreachable" : gpus?.cuda ? "CUDA ready" : "CPU / none"}
          accent={Boolean(gpus?.cuda) && !hwError}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.8fr_1fr] gap-6">
        <ConsoleSection
          title="Recent Runs"
          icon={Activity}
          badge={loading ? "Syncing queue" : `${recent.length} visible`}
          action={
            <Link to="/finetune/runs" className="text-[11px] font-mono uppercase tracking-widest text-neu-accent no-underline flex items-center gap-1">
              All runs <ArrowRight size={12} />
            </Link>
          }
        >
          {loading ? (
            <p className="text-neu-dim text-sm py-8 text-center">Loading...</p>
          ) : recent.length === 0 ? (
            <EmptyPanel
              icon={Zap}
              title="No runs yet"
              description="Start a new training run to populate this queue."
              action={
                <button onClick={startNewRun} className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest">
                  Start first run
                </button>
              }
            />
          ) : (
            <div className="flex flex-col gap-3">
              {recent.map((r) => {
                const m = statusMeta(r.status);
                return (
                  <Link
                    key={r.job_id}
                    to={`/finetune/runs/${r.job_id}`}
                    className="neu-plate p-4 rounded-2xl no-underline group hover:-translate-y-0.5 transition-transform"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`led ${m.led} shrink-0`} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-neu-text truncate">
                            {r.model_name || "—"}
                          </div>
                          <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                            {METHOD_LABEL[r.training_type] || r.training_type} · {shortId(r.job_id)}
                          </div>
                        </div>
                      </div>
                      <span className={`neu-badge ${m.cls}`}>{m.label}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest">
                      <span className="text-neu-dim">{fmtTime(r.created_at)}</span>
                      <span className="text-neu-dim/70">
                        Progress {r.progress ?? 0}%
                        {r.total_steps ? ` · ${r.step || 0}/${r.total_steps}` : ""}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ConsoleSection>

        <ConsoleSection title="Hardware" icon={Cpu} badge={hwError ? "Backend offline" : "Runtime probe"}>
          {hwError ? (
            <div className="neu-trough p-5 rounded-xl text-center text-red-400 text-xs flex flex-col items-center gap-2">
              <WifiOff size={18} />
              <span>Cannot reach the backend on :8001.</span>
              <span className="text-neu-dim/70 font-mono">{hwError}</span>
            </div>
          ) : gpus?.gpus?.filter((g) => g.vram_total > 0)?.length ? (
            <div className="flex flex-col gap-3">
              {gpus.gpus
                .filter((g) => g.vram_total > 0)
                .map((g) => (
                  <div key={g.id} className="neu-plate p-4 rounded-2xl">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-bold text-neu-text truncate">{g.name}</div>
                        <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                          {(g.vram_total / 1024).toFixed(0)} GB VRAM
                        </div>
                      </div>
                      <span className="neu-badge neu-badge-green">ready</span>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <EmptyPanel
              icon={Cpu}
              title="No CUDA GPU detected"
              description="Training will fall back to CPU or whatever hardware the backend exposes."
            />
          )}
        </ConsoleSection>
      </div>
    </div>
  );
}
