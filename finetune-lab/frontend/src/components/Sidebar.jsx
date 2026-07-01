import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Plus, ListChecks, Boxes, PackageOpen, Settings, Layers } from "lucide-react";
import { useWizard } from "../modules/finetune/context/WizardContext";

const NAV = [
  { to: "/finetune/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/finetune/runs", label: "Runs", icon: ListChecks },
  { to: "/finetune/models", label: "Models", icon: Boxes },
  { to: "/finetune/exports", label: "Exports", icon: PackageOpen },
  { to: "/finetune/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const { reset } = useWizard();

  const startNewRun = () => {
    reset();
    navigate("/finetune/new/model");
  };

  return (
    <aside className="w-64 shrink-0 min-h-screen p-5 flex flex-col gap-8 border-r border-white/5 sticky top-0 self-start">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2">
        <div className="w-11 h-11 rounded-2xl neu-plate flex items-center justify-center text-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)]">
          <Layers size={22} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-neu-text tracking-tight leading-none">Finetune Lab</h1>
          <span className="text-[10px] text-neu-dim font-mono uppercase tracking-[0.2em]">LLM Studio</span>
        </div>
      </div>

      {/* Primary CTA */}
      <button
        onClick={startNewRun}
        className="neu-btn-primary flex items-center justify-center gap-2 py-3 rounded-2xl font-bold uppercase tracking-widest text-xs"
      >
        <Plus size={16} /> New Run
      </button>

      {/* Nav */}
      <nav className="flex flex-col gap-1.5">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium no-underline transition-all duration-200 ${
                isActive
                  ? "neu-inset text-neu-accent"
                  : "text-neu-dim hover:text-neu-text hover:bg-white/5"
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-2">
        <div className="neu-trough rounded-xl p-3 text-[10px] font-mono text-neu-dim/60 uppercase tracking-widest">
          Local-first · single GPU
        </div>
      </div>
    </aside>
  );
}
