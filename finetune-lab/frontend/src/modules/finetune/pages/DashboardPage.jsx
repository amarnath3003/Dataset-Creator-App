import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Activity, CheckCircle2, Cpu, ArrowRight, Layers, Zap, WifiOff } from "lucide-react";
import { training, hardware } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { statusMeta, fmtTime, shortId, METHOD_LABEL } from "../lib/format";

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
        // Never reject: on network failure resolve a sentinel so we can tell
        // "backend unreachable" apart from "backend up, zero GPUs" — those
        // used to render identically, which reads as a false "all clear".
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
  };
  const recent = runs.slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-4xl font-light text-neu-text tracking-tight">Dashboard</h1>
          <p className="text-neu-dim/60 font-mono text-[11px] uppercase tracking-[0.25em] mt-2">
            Local fine-tuning studio
          </p>
        </div>
        <button onClick={startNewRun} className="neu-btn-primary flex items-center gap-2 px-6 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs">
          <Plus size={16} /> New Run
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        <StatCard icon={Layers} label="Total Runs" value={counts.total} />
        <StatCard icon={Activity} label="Active" value={counts.running} accent />
        <StatCard icon={CheckCircle2} label="Completed" value={counts.completed} />
        <StatCard
          icon={Cpu}
          label="GPUs Detected"
          value={hwError ? "—" : gpus ? gpus.count ?? 0 : "—"}
          sub={hwError ? "backend unreachable" : gpus?.cuda ? "CUDA ready" : "CPU / none"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent runs */}
        <div className="lg:col-span-2 neu-section">
          <div className="neu-section-header">
            <h2 className="flex items-center gap-2 text-neu-text font-bold">
              <Activity size={18} className="text-neu-dim" /> Recent Runs
            </h2>
            <Link to="/finetune/runs" className="text-[11px] font-mono uppercase tracking-widest text-neu-accent no-underline flex items-center gap-1">
              All runs <ArrowRight size={12} />
            </Link>
          </div>
          <div className="neu-section-body">
            {loading ? (
              <p className="text-neu-dim text-sm py-8 text-center">Loading…</p>
            ) : recent.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <Zap size={28} className="mx-auto text-neu-dim/40" />
                <p className="text-neu-dim text-sm">No runs yet.</p>
                <button onClick={startNewRun} className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest">
                  Start your first run
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {recent.map((r) => {
                  const m = statusMeta(r.status);
                  return (
                    <Link
                      key={r.job_id}
                      to={`/finetune/runs/${r.job_id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl neu-plate no-underline hover:-translate-y-0.5 transition-transform"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`led ${m.led}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-neu-text truncate">
                            {r.model_name || "—"}
                          </div>
                          <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">
                            {METHOD_LABEL[r.training_type] || r.training_type} · {shortId(r.job_id)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className={`neu-badge ${m.cls}`}>{m.label}</span>
                        <span className="text-[10px] font-mono text-neu-dim hidden md:block">{fmtTime(r.created_at)}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Hardware panel */}
        <div className="neu-section">
          <div className="neu-section-header">
            <h2 className="flex items-center gap-2 text-neu-text font-bold">
              <Cpu size={18} className="text-neu-dim" /> Hardware
            </h2>
            <div className={`led ${hwError ? "led-red" : gpus?.cuda ? "led-green" : "led-off"}`} />
          </div>
          <div className="neu-section-body space-y-3">
            {hwError ? (
              <div className="neu-trough p-5 rounded-xl text-center text-red-400 text-xs flex flex-col items-center gap-2">
                <WifiOff size={18} />
                <span>Can't reach the backend — is it running on :8000?</span>
                <span className="text-neu-dim/70 font-mono">{hwError}</span>
              </div>
            ) : gpus?.gpus?.filter((g) => g.vram_total > 0)?.length ? (
              gpus.gpus
                .filter((g) => g.vram_total > 0)
                .map((g) => (
                  <div key={g.id} className="neu-plate p-4 rounded-xl">
                    <div className="text-sm font-bold text-neu-text truncate">{g.name}</div>
                    <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest mt-1">
                      {(g.vram_total / 1024).toFixed(0)} GB VRAM
                    </div>
                  </div>
                ))
            ) : (
              <div className="neu-trough p-5 rounded-xl text-center text-neu-dim text-xs">
                No CUDA GPU detected. Training will fall back to CPU or whatever hardware the server actually has.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, accent }) {
  const Icon = icon;
  return (
    <div className="neu-plate p-5 rounded-2xl flex flex-col gap-2">
      <Icon size={18} className={accent ? "text-neu-accent" : "text-neu-dim"} />
      <div className="text-3xl font-bold text-neu-text leading-none">{value}</div>
      <div className="text-[10px] font-mono text-neu-dim uppercase tracking-widest">{label}</div>
      {sub && <div className="text-[10px] text-neu-dim/60">{sub}</div>}
    </div>
  );
}
