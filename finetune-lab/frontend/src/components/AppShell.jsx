import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Layers, Plus } from "lucide-react";
import Sidebar from "./Sidebar";
import { useWizard } from "../modules/finetune/context/WizardContext";
import { getRouteMeta, NAV_ITEMS } from "../modules/finetune/lib/navigation";

export default function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { reset } = useWizard();
  const route = getRouteMeta(location.pathname);
  const isWizard = location.pathname.startsWith("/finetune/new");

  const startNewRun = () => {
    reset();
    navigate("/finetune/new/model");
  };

  return (
    <div className="min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased">
      <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/finetune/dashboard" className="flex items-center gap-4 group no-underline">
            <div className="w-12 h-12 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)] group-hover:shadow-[0_0_20px_rgba(255,107,0,0.35)] transition-all duration-500">
              <Layers size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neu-text tracking-tight group-hover:text-neu-accent transition-colors duration-300">
                Finetune Lab
              </h1>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-neu-accent/60 animate-pulse" />
                <span className="text-xs text-neu-dim font-medium tracking-wider uppercase">
                  Model Training Console
                </span>
              </div>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <div className="neu-inset px-4 py-2 rounded-xl">
              <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
                {route.label}
              </span>
            </div>
            <button
              onClick={startNewRun}
              className="group relative flex items-center justify-center gap-3 px-6 py-3 rounded-[18px] font-bold tracking-widest text-[12px] uppercase bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98] transition-all"
            >
              <div className="flex items-center justify-center p-2 rounded-[12px] bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20 group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.8)] transition-all duration-150">
                <Plus size={16} />
              </div>
              <span className="group-hover:text-neu-accent transition-colors">New Run</span>
            </button>
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
            <div className="flex items-center gap-2">
              <div className={`led ${isWizard ? "led-on" : "led-off"}`} />
              <span className={`text-[10px] font-bold tracking-widest uppercase ${isWizard ? "text-neu-accent" : "text-neu-dim/40"}`}>
                Setup
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] font-mono uppercase tracking-widest">
            <span className="text-neu-dim">{route.shortLabel}</span>
            <span className="neu-badge neu-badge-accent">{route.pulse}</span>
          </div>
        </div>

        <div className="flex flex-col gap-6 lg:flex-row animate-in fade-in duration-500">
          <Sidebar />
          <main className="flex-1 min-w-0 neu-plate rounded-[30px] p-6 lg:p-8 xl:p-10">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
