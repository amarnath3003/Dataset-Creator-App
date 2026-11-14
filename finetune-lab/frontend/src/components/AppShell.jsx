import { Link, Outlet, useLocation } from "react-router-dom";
import { Layers, Flame, MessagesSquare } from "lucide-react";
import Sidebar from "./Sidebar";
import { getRouteMeta, NAV_ITEMS } from "../modules/finetune/lib/navigation";

const LABS = [
  { label: "Dataset Lab", href: "http://localhost:5173", icon: Layers, active: false },
  { label: "Finetune Lab", href: "http://localhost:5174", icon: Flame, active: true },
  { label: "Chat Lab", href: "http://localhost:5273", icon: MessagesSquare, active: false },
];

export default function AppShell() {
  const location = useLocation();
  const route = getRouteMeta(location.pathname);
  const isWizard = location.pathname.startsWith("/finetune/new");

  return (
    <div className="min-h-screen bg-neu-base text-neu-text selection:bg-neu-accent selection:text-white font-sans antialiased">
      <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <Link to="/finetune/dashboard" className="flex items-center gap-4 group no-underline">
            <div className="w-12 h-12 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)] group-hover:shadow-[0_0_20px_rgba(255,107,0,0.35)] transition-all duration-500">
              <Flame size={24} />
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

          <nav className="inline-flex items-center gap-1.5 neu-trough p-1.5 rounded-full self-start lg:self-center border border-black/30 shadow-[inset_2px_2px_6px_#13161a,inset_-2px_-2px_6px_#2a3038,0_10px_24px_rgba(0,0,0,0.18)]">
            {LABS.map(({ label, href, icon: Icon, active }) => (
              <a
                key={label}
                href={href}
                className={`group flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold tracking-widest uppercase transition-all duration-200 no-underline ${
                  active
                    ? "bg-neu-dark text-neu-accent shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33,0_0_14px_rgba(255,107,0,0.12)] border border-black/40 scale-[0.98]"
                    : "text-neu-dim hover:text-neu-text hover:-translate-y-0.5 hover:shadow-[0_6px_14px_rgba(0,0,0,0.16)]"
                }`}
              >
                <Icon size={14} className={active ? "text-neu-accent" : "transition-all duration-200 group-hover:text-neu-accent"} />
                {label}
              </a>
            ))}
          </nav>

          <div className="neu-inset px-4 py-2 rounded-xl self-start lg:self-center">
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
