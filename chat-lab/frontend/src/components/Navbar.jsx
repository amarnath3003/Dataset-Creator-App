import React, { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { MessagesSquare, GitCompareArrows, Archive, ListChecks, Cpu, Layers, Flame } from "lucide-react";
import { modelApi } from "../modules/chat/services/modelApi";

const TABS = [
  { to: "/chat", label: "Chat", icon: MessagesSquare },
  { to: "/compare", label: "Compare", icon: GitCompareArrows },
  { to: "/conversations", label: "History", icon: Archive },
  { to: "/presets", label: "Presets", icon: ListChecks },
];

const LABS = [
  { label: "Dataset", href: "http://localhost:5173", icon: Layers, active: false },
  { label: "Finetune", href: "http://localhost:5174", icon: Flame, active: false },
  { label: "Chat", href: "http://localhost:5273", icon: MessagesSquare, active: true },
];

export default function Navbar() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    let alive = true;
    const poll = () => modelApi.getStatus().then((s) => alive && setStatus(s)).catch(() => {});
    poll();
    const id = setInterval(poll, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const gpu = status?.gpu || {};
  const torchOk = status?.torch_available;
  const ollamaOk = status?.ollama_available;
  const simOk = status?.sim_available;
  const loadedCount = status?.loaded?.length || 0;

  let ledClass = "led-off";
  let statusText = "Offline";
  if (torchOk && gpu.cuda) {
    ledClass = "led-green";
    statusText = loadedCount ? `${loadedCount} model${loadedCount > 1 ? "s" : ""} resident` : "GPU ready";
  } else if (ollamaOk) {
    ledClass = "led-green";
    statusText = "Ollama ready";
  } else if (torchOk) {
    ledClass = "led-on";
    statusText = "CPU ready";
  } else if (simOk) {
    ledClass = "led-on";
    statusText = "Sim Runtime";
  } else if (status) {
    ledClass = "led-red";
    statusText = "No ML stack";
  }

  return (
    <header className="mb-6 grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
      <Link to="/chat" className="flex items-center gap-4 group no-underline">
        <div className="w-12 h-12 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)] group-hover:shadow-[0_0_20px_rgba(255,107,0,0.4)] transition-all duration-500">
          <MessagesSquare size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-neu-text tracking-tight group-hover:text-neu-accent transition-colors duration-300">
            Chat Lab
          </h1>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-neu-accent/50 animate-pulse"></div>
            <span className="text-xs text-neu-dim font-medium tracking-wider uppercase">Model Test Console</span>
          </div>
        </div>
      </Link>

      <nav className="hidden md:inline-flex items-center gap-1.5 neu-trough p-1.5 rounded-full justify-self-center self-center w-auto max-w-full border border-black/30 shadow-[inset_2px_2px_6px_#13161a,inset_-2px_-2px_6px_#2a3038,0_10px_24px_rgba(0,0,0,0.18)]">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `group flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold tracking-widest uppercase transition-all duration-200 no-underline ${
                isActive
                  ? "bg-neu-dark text-neu-accent shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33,0_0_14px_rgba(255,107,0,0.12)] border border-black/40 scale-[0.98]"
                  : "text-neu-dim hover:text-neu-text hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(0,0,0,0.16)]"
              }`
            }
          >
            <Icon size={15} className="transition-all duration-200 group-hover:text-neu-accent" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-3 justify-self-start xl:justify-self-end">
        <div className="inline-flex items-center gap-1 neu-trough p-1 rounded-full border border-black/30">
          {LABS.map(({ label, href, icon: Icon, active }) => (
            <a
              key={label}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all duration-200 no-underline ${
                active
                  ? "bg-neu-dark text-neu-accent shadow-[inset_2px_2px_5px_#0e1012,inset_-2px_-2px_5px_#272d33] border border-black/40"
                  : "text-neu-dim hover:text-neu-text"
              }`}
              title={`Open ${label} Lab`}
            >
              <Icon size={12} />
              {label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 neu-plate px-4 py-2.5 rounded-full" title={gpu.device || statusText}>
          <Cpu size={15} className="text-neu-dim" />
          <div className="flex flex-col leading-tight">
            <div className="flex items-center gap-2">
              <div className={`led ${ledClass}`} style={{ width: 8, height: 8 }}></div>
              <span className="text-[11px] font-bold text-neu-text tracking-wide">{statusText}</span>
            </div>
            {gpu.cuda && gpu.vram_total_mb ? (
              <span className="text-[9px] font-mono text-neu-dim uppercase tracking-wider">
                {Math.round((gpu.vram_used_mb / gpu.vram_total_mb) * 100)}% - {(gpu.vram_total_mb / 1024).toFixed(0)}GB
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
