import { NavLink, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { NAV_ITEMS } from "../modules/chat/lib/navigation";

export default function Sidebar({ statusText, detailText }) {
  const navigate = useNavigate();

  const startNewChat = () => {
    navigate(`/chat?fresh=${Date.now()}`);
  };

  return (
    <aside className="grid grid-cols-2 sm:grid-cols-3 lg:flex lg:w-56 lg:flex-col shrink-0 gap-3">
      <button
        onClick={startNewChat}
        className="group relative h-[88px] col-span-full sm:col-span-3 lg:col-span-1 min-w-0 flex items-center gap-4 px-5 py-4 rounded-[20px] text-left outline-none touch-manipulation select-none overflow-hidden bg-neu-base text-neu-text shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5 active:bg-neu-dark active:text-neu-accent active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98] transition-all"
      >
        <div className="flex-shrink-0 p-2.5 rounded-[12px] bg-[#15181b] text-neu-accent shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20 group-active:drop-shadow-[0_0_8px_rgba(255,107,0,0.8)] transition-all duration-150">
          <Plus size={18} />
        </div>
        <div className="flex-1 min-w-0 pr-4">
          <span className="text-[13px] font-bold tracking-wide block truncate group-hover:text-neu-accent transition-colors duration-150">
            New Chat
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-neu-dim/70">
            Reset session
          </span>
        </div>
        <div className="absolute right-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]" />
      </button>

      <nav className="col-span-full grid grid-cols-2 sm:grid-cols-3 lg:flex lg:flex-col gap-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.key}
            to={item.to}
            className={({ isActive }) =>
              `relative h-[88px] min-w-0 group flex items-center gap-4 px-5 py-4 rounded-[20px] text-left outline-none touch-manipulation select-none overflow-hidden no-underline ${
                isActive
                  ? "bg-neu-dark text-neu-accent shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] border border-black/40 scale-[0.98]"
                  : "bg-neu-base text-neu-dim shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] hover:-translate-y-0.5 border border-white/5"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={`flex-shrink-0 p-2.5 rounded-[12px] transition-all duration-150 ${
                    isActive
                      ? "bg-[#15181b] shadow-[inset_2px_2px_4px_#0e1012,inset_-2px_-2px_4px_#272d33,0_0_12px_rgba(255,107,0,0.15)] ring-1 ring-neu-accent/20"
                      : "bg-neu-base shadow-[3px_3px_6px_#111315,-3px_-3px_6px_#2e343b]"
                  }`}
                >
                  <item.icon
                    size={18}
                    strokeWidth={isActive ? 2 : 1.5}
                    className={isActive ? "text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.8)]" : "text-neu-dim"}
                  />
                </div>

                <div className="flex-1 min-w-0 pr-4">
                  <span
                    className={`text-[13px] font-bold tracking-wide block truncate transition-colors duration-150 ${
                      isActive ? "text-neu-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.35)]" : "text-neu-text"
                    }`}
                  >
                    {item.label}
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-neu-dim/70">
                    {item.shortLabel}
                  </span>
                </div>

                <div
                  className={`absolute right-5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full transition-all duration-200 ${
                    isActive
                      ? "bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]"
                      : "bg-black/40 shadow-[inset_1px_1px_2px_#000]"
                  }`}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="hidden lg:block mt-auto">
        <div className="neu-trough rounded-[20px] p-4 text-[10px] font-mono uppercase tracking-widest">
          <div className="flex items-center gap-2 text-neu-accent mb-2">
            <div className="led led-on" />
            Runtime
          </div>
          <div className="text-neu-text mb-2">{statusText}</div>
          <div className="text-neu-dim/70 leading-relaxed">{detailText}</div>
        </div>
      </div>
    </aside>
  );
}
