import { Link, Outlet, useLocation } from "react-router-dom";
import { MessagesSquare } from "lucide-react";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { modelApi } from "../modules/chat/services/modelApi";
import { getRouteMeta, NAV_ITEMS } from "../modules/chat/lib/navigation";

export default function AppShell() {
  const location = useLocation();
  const route = getRouteMeta(location.pathname);
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
  const loadedCount = status?.loaded?.length || 0;

  let systemState = "Offline";
  let detailText = "backend idle";
  if (torchOk && gpu.cuda) {
    systemState = loadedCount ? `${loadedCount} model${loadedCount > 1 ? "s" : ""} resident` : "GPU ready";
    detailText = gpu.vram_total_mb ? `${(gpu.vram_total_mb / 1024).toFixed(0)} GB available` : "CUDA runtime";
  } else if (torchOk) {
    systemState = "CPU only";
    detailText = "torch available";
  } else if (status) {
    systemState = "No ML stack";
    detailText = "model runtime missing";
  }

  return (
    <div className="min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased">
      <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/chat" className="flex items-center gap-4 group no-underline">
            <div className="w-12 h-12 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)] group-hover:shadow-[0_0_20px_rgba(255,107,0,0.35)] transition-all duration-500">
              <MessagesSquare size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neu-text tracking-tight group-hover:text-neu-accent transition-colors duration-300">
                Chat Lab
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neu-accent/60 animate-pulse" />
                <span className="text-xs text-neu-dim font-medium tracking-wider uppercase">
                  Model Test Console
                </span>
              </div>
            </div>
          </Link>

          <div className="neu-inset px-4 py-2 rounded-xl">
            <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
              {route.label}
            </span>
          </div>
        </header>

        <div className="neu-trough px-5 py-3.5 rounded-2xl flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="flex flex-wrap items-center gap-5">
            {NAV_ITEMS.map((item) => (
              <div key={item.key} className="flex items-center gap-2">
                <div className={`led ${location.pathname.startsWith(item.to) ? "led-on" : "led-off"}`} />
                <span
                  className={`text-[10px] font-bold tracking-widest uppercase ${
                    location.pathname.startsWith(item.to) ? "text-neu-accent" : "text-neu-dim/40"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest">
            <span className="text-neu-dim">{route.shortLabel}</span>
            <span className="neu-badge neu-badge-accent">{route.pulse}</span>
            <span className="neu-badge">{systemState}</span>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row animate-in fade-in duration-500">
          <Sidebar statusText={systemState} detailText={detailText} />
          <main className="flex-1 min-w-0 neu-plate rounded-[30px] p-6 lg:p-8 xl:p-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
