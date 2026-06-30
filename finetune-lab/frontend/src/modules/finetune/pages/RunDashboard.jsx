import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTrainingStatus } from "../services/trainingApi";
import {
  Activity,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Clock,
  TrendingDown,
} from "lucide-react";

const TERMINAL = new Set(["completed", "failed"]);

function fmtEta(seconds) {
  if (seconds == null) return "—";
  if (seconds <= 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtVram(mb) {
  if (!mb) return "0 GB";
  return `${(mb / 1024).toFixed(2)} GB`;
}

export default function RunDashboard() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [connError, setConnError] = useState(false);
  const terminalRef = useRef(null);

  useEffect(() => {
    let active = true;
    let interval;

    const poll = async () => {
      try {
        const status = await getTrainingStatus(id);
        if (!active) return;
        setJob(status);
        setConnError(false);
        if (TERMINAL.has(status.status)) clearInterval(interval);
      } catch (e) {
        if (active) setConnError(true);
      }
    };

    poll();
    interval = setInterval(poll, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id]);

  // Auto-scroll the log terminal to the bottom on update.
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [job?.logs?.length]);

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
  const progress = job.progress || 0;
  const isRunning = status === "running";
  const isDone = status === "completed";
  const isFailed = status === "failed";
  const logs = job.logs || [];

  const ledClass = isRunning
    ? "led-green animate-pulse"
    : isFailed
    ? "led-red"
    : isDone
    ? "led-green"
    : "led-on";

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link
          to="/finetune/models"
          className="neu-btn flex items-center gap-2 px-4 py-2 text-sm text-neu-dim hover:text-neu-text rounded-xl no-underline"
        >
          <ArrowLeft size={16} />
          Exit
        </Link>

        <div className="neu-inset px-4 py-2 rounded-xl">
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            RUN: {String(id).split("-")[0] || id}
          </span>
        </div>
      </div>

      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <Activity size={18} className="text-neu-dim" />
            Training Telemetry
          </h2>
          <div className={`led ${ledClass}`}></div>
        </div>

        <div className="neu-section-body space-y-8">
          {/* Top stat row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="neu-stat">
              <span
                className={`neu-stat-value capitalize ${
                  isFailed ? "text-red-500" : isDone ? "text-green-500" : "text-neu-accent"
                }`}
              >
                {status}
              </span>
              <span className="neu-stat-label">System Status</span>
            </div>
            <div className="neu-stat">
              <span className="neu-stat-value flex items-center gap-1">
                <TrendingDown size={16} className="text-neu-dim" />
                {job.loss != null ? job.loss : "—"}
              </span>
              <span className="neu-stat-label">Training Loss</span>
            </div>
            <div className="neu-stat">
              <span className="neu-stat-value flex items-center gap-1">
                <Cpu size={16} className="text-neu-dim" />
                {fmtVram(job.vram_mb)}
              </span>
              <span className="neu-stat-label">Peak VRAM</span>
            </div>
            <div className="neu-stat">
              <span className="neu-stat-value flex items-center gap-1">
                <Clock size={16} className="text-neu-dim" />
                {isDone ? "Done" : fmtEta(job.eta_seconds)}
              </span>
              <span className="neu-stat-label">ETA</span>
            </div>
          </div>

          {/* Progress */}
          <div className="neu-trough p-4 rounded-xl">
            <div className="flex justify-between text-xs font-mono text-neu-dim mb-2 uppercase tracking-widest">
              <span>
                Step {job.step || 0}
                {job.total_steps ? ` / ${job.total_steps}` : ""}
                {job.epoch != null ? `  ·  epoch ${job.epoch}` : ""}
              </span>
              <span>{progress}%</span>
            </div>
            <div className="neu-progress-track w-full">
              <div
                className="neu-progress-fill transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>

          {/* Live log terminal */}
          <div ref={terminalRef} className="neu-terminal max-h-80 overflow-y-auto whitespace-pre-wrap">
            {logs.length > 0
              ? logs.join("\n")
              : `> Run ${id} created.\n> Waiting for the engine to emit telemetry…`}
          </div>

          {/* Terminal states */}
          {isDone && (
            <div className="neu-alert-info flex items-start gap-2">
              <CheckCircle2 size={16} className="text-green-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-neu-text">Training complete.</p>
                {job.final_dir && (
                  <p className="text-neu-dim font-mono text-xs mt-1 break-all">
                    Artifacts: {job.final_dir}
                  </p>
                )}
                {job.metrics?.train_runtime != null && (
                  <p className="text-neu-dim text-xs mt-1">
                    Runtime: {Math.round(job.metrics.train_runtime)}s
                    {job.metrics["train_loss"] != null
                      ? ` · final loss ${Number(job.metrics["train_loss"]).toFixed(4)}`
                      : ""}
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
            <p className="text-[10px] font-mono text-neu-dim uppercase tracking-widest text-center">
              ⚠ Reconnecting to backend…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
