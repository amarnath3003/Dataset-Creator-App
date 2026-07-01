import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Activity, ArrowLeft, Loader2, AlertCircle, CheckCircle2, Cpu, Clock, TrendingDown,
  Square, Gauge, PackageOpen, Box, HardDrive, Cloud, FileArchive,
} from "lucide-react";
import { training, exports as exportApi } from "../services/finetuneApi";
import { useSettings } from "../context/SettingsContext";
import LossChart from "../../../components/LossChart";
import { statusMeta, fmtEta, fmtVram, shortId, TERMINAL } from "../lib/format";

export default function RunDashboard() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [connError, setConnError] = useState(false);
  const [stopping, setStopping] = useState(false);
  const terminalRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const status = await training.status(id);
      setJob(status);
      setConnError(false);
      return status.status;
    } catch {
      setConnError(true);
      return null;
    }
  }, [id]);

  useEffect(() => {
    let active = true;
    let interval;
    const tick = async () => {
      const s = await poll();
      if (active && s && TERMINAL.has(s)) clearInterval(interval);
    };
    tick();
    interval = setInterval(tick, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [poll]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [job?.logs?.length]);

  const onStop = async () => {
    setStopping(true);
    try {
      await training.stop(id);
      await poll();
    } finally {
      setStopping(false);
    }
  };

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-4">
        <Loader2 size={48} className="text-neu-accent animate-spin mb-2" />
        <h1 className="text-3xl font-light text-neu-text tracking-tight">Initializing Engine</h1>
        <p className="text-neu-dim font-mono text-xs uppercase tracking-widest">
          {connError ? "Connecting to backend…" : "Establishing run telemetry…"}
        </p>
      </div>
    );
  }

  const status = job.status || "queued";
  const meta = statusMeta(status);
  const progress = job.progress || 0;
  const isRunning = status === "running" || status === "cancelling";
  const isDone = status === "completed";
  const isCancelled = status === "cancelled";
  const isFailed = status === "failed";
  const logs = job.logs || [];
  const canExport = isDone || isCancelled;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link to="/finetune/runs" className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-neu-dim hover:text-neu-text rounded-xl no-underline">
          <ArrowLeft size={16} /> Runs
        </Link>
        <div className="flex items-center gap-3">
          {isRunning && (
            <button onClick={onStop} disabled={stopping || status === "cancelling"} className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-red-400 rounded-xl">
              <Square size={14} /> {status === "cancelling" ? "Stopping…" : stopping ? "…" : "Stop"}
            </button>
          )}
          <div className="neu-inset px-4 py-2 rounded-xl">
            <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">RUN: {shortId(id)}</span>
          </div>
        </div>
      </div>

      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <Activity size={18} className="text-neu-dim" /> Training Telemetry
          </h2>
          <div className={`led ${meta.led}`}></div>
        </div>

        <div className="neu-section-body space-y-8">
          {/* Stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <Stat value={<span className={`capitalize ${meta.text}`}>{meta.label}</span>} label="Status" />
            <Stat icon={TrendingDown} value={job.loss != null ? job.loss : "—"} label="Training Loss" />
            <Stat icon={Cpu} value={fmtVram(job.vram_mb)} label="Peak VRAM" />
            <Stat icon={Clock} value={isDone ? "Done" : fmtEta(job.eta_seconds)} label="ETA" />
          </div>

          {/* Progress */}
          <div className="neu-trough p-4 rounded-xl">
            <div className="flex justify-between text-xs font-mono text-neu-dim mb-2 uppercase tracking-widest">
              <span>
                Step {job.step || 0}{job.total_steps ? ` / ${job.total_steps}` : ""}{job.epoch != null ? `  ·  epoch ${job.epoch}` : ""}
                {job.tokens_per_sec ? `  ·  ${job.tokens_per_sec} tok/s` : ""}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="neu-progress-track w-full">
              <div className="neu-progress-fill transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          {/* Loss chart */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold text-neu-dim uppercase tracking-widest">
              <Gauge size={12} className="text-neu-accent" /> Loss Curve
            </div>
            <LossChart data={job.loss_history || []} />
          </div>

          {/* Log terminal */}
          <div ref={terminalRef} className="neu-terminal max-h-80 overflow-y-auto whitespace-pre-wrap">
            {logs.length > 0 ? logs.join("\n") : `> Run ${id} created.\n> Waiting for the engine to emit telemetry…`}
          </div>

          {/* Terminal states */}
          {(isDone || isCancelled) && (
            <div className="neu-alert-info flex items-start gap-2">
              <CheckCircle2 size={16} className="text-green-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-neu-text">{isCancelled ? "Run cancelled — partial adapter saved." : "Training complete."}</p>
                {job.final_dir && <p className="text-neu-dim font-mono text-xs mt-1 break-all">Artifacts: {job.final_dir}</p>}
                {job.metrics?.train_runtime != null && (
                  <p className="text-neu-dim text-xs mt-1">
                    Runtime: {Math.round(job.metrics.train_runtime)}s
                    {job.metrics.train_loss != null ? ` · final loss ${Number(job.metrics.train_loss).toFixed(4)}` : ""}
                  </p>
                )}
              </div>
            </div>
          )}

          {isFailed && job.error && (
            <div className="neu-alert-warn mt-4">
              <AlertCircle size={16} />
              <span className="break-all">Engine Error: {job.error}</span>
            </div>
          )}

          {connError && !TERMINAL.has(status) && (
            <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest text-center">⚠ Reconnecting to backend…</p>
          )}
        </div>
      </div>

      {/* Export panel */}
      {canExport && <ExportPanel runId={id} />}
    </div>
  );
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="neu-stat">
      <span className="neu-stat-value flex items-center gap-1">
        {Icon && <Icon size={16} className="text-neu-dim" />}
        {value}
      </span>
      <span className="neu-stat-label">{label}</span>
    </div>
  );
}

const EXPORT_KINDS = [
  { kind: "adapter", label: "Adapter", icon: FileArchive, desc: "Copy the LoRA adapter (instant)" },
  { kind: "merged_16bit", label: "Merged 16-bit", icon: Box, desc: "Merge into a standalone checkpoint" },
  { kind: "gguf", label: "GGUF", icon: HardDrive, desc: "llama.cpp / Ollama format" },
  { kind: "hub", label: "Push to Hub", icon: Cloud, desc: "Upload merged model to HF" },
];

function ExportPanel({ runId }) {
  const { settings } = useSettings();
  const [jobs, setJobs] = useState([]);
  const [repoId, setRepoId] = useState(settings.defaultRepoPrefix ? `${settings.defaultRepoPrefix}/` : "");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setJobs(await exportApi.forRun(runId));
    } catch {
      /* ignore */
    }
  }, [runId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const startExport = async (kind) => {
    setError(null);
    const options = {};
    if (kind === "gguf") options.quantization_method = settings.ggufQuant;
    if (kind === "hub") {
      if (!repoId.trim() || repoId.trim().endsWith("/")) {
        setError("Enter a full repo id, e.g. username/my-model.");
        return;
      }
      if (!settings.hfToken) {
        setError("Add a Hugging Face token in Settings to push to the Hub.");
        return;
      }
      options.repo_id = repoId.trim();
      options.hf_token = settings.hfToken;
      options.private = settings.hubPrivate;
    }
    setBusy(kind);
    try {
      await exportApi.create({ run_id: runId, kind, options });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const badge = (s) => (s === "completed" ? "neu-badge-green" : s === "failed" ? "neu-badge-red" : "neu-badge-accent");

  return (
    <div className="neu-section">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <PackageOpen size={18} className="text-neu-dim" /> Export
        </h2>
        <Link to="/finetune/exports" className="text-[11px] font-mono uppercase tracking-widest text-neu-accent no-underline">All exports</Link>
      </div>
      <div className="neu-section-body space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EXPORT_KINDS.map((k) => (
            <button
              key={k.kind}
              onClick={() => startExport(k.kind)}
              disabled={busy === k.kind}
              className="neu-plate p-4 rounded-xl flex items-center gap-3 text-left hover:-translate-y-0.5 transition-transform disabled:opacity-50"
            >
              <div className="w-9 h-9 rounded-lg neu-inset flex items-center justify-center text-neu-accent shrink-0">
                <k.icon size={16} />
              </div>
              <div>
                <div className="text-sm font-bold text-neu-text">{busy === k.kind ? "Starting…" : k.label}</div>
                <div className="text-[10px] text-neu-dim">{k.desc}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Hub repo input */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Hub Repo ID (for Push to Hub)</label>
          <div className="neu-trough">
            <input value={repoId} onChange={(e) => setRepoId(e.target.value)} placeholder="username/my-finetuned-model" className="neu-input bg-transparent shadow-none" />
          </div>
          {!settings.hfToken && (
            <p className="text-[11px] text-neu-dim">
              No HF token set — add one in <Link to="/finetune/settings" className="text-neu-accent no-underline">Settings</Link> to enable Hub pushes.
            </p>
          )}
        </div>

        {error && (
          <div className="neu-alert-warn"><AlertCircle size={16} /><span>{error}</span></div>
        )}

        {/* Export job list */}
        {jobs.length > 0 && (
          <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
            {jobs.map((e) => (
              <div key={e.export_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg neu-trough">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-neu-text uppercase">{e.kind}</div>
                  {e.output_path && <div className="text-[10px] font-mono text-neu-dim truncate">{e.output_path}</div>}
                  {e.error && <div className="text-[10px] text-red-400 truncate">{e.error}</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {e.status !== "completed" && e.status !== "failed" && (
                    <span className="text-[10px] font-mono text-neu-dim">{e.progress ?? 0}%</span>
                  )}
                  <span className={`neu-badge ${badge(e.status)}`}>{e.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
