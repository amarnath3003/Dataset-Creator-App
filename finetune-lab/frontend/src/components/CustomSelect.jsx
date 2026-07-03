import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export function CustomSelect({ value, options, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={containerRef} className={`relative ${isOpen ? "z-50" : "z-30"}`}>
      {/* The closed / trigger state */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full neu-input flex items-center justify-between text-left transition-all duration-200 relative z-20 ${
          isOpen
            ? "rounded-b-none border-t-neu-accent border-l-neu-accent border-r-neu-accent border-b-transparent shadow-[0_0_15px_rgba(255,107,0,0.2)] bg-neu-dark"
            : "border-transparent"
        }`}
        style={isOpen ? { boxShadow: "0 -4px 12px rgba(255,107,0,0.1)" } : {}}
      >
        <span className={!value ? "text-neu-dim/30" : "text-neu-text"}>{selectedOption?.label || value || "Select..."}</span>
        <ChevronDown size={14} className={`text-neu-dim transition-transform duration-300 ${isOpen ? "rotate-180 text-neu-accent" : ""}`} />
      </button>

      {/* The open dropdown menu */}
      {isOpen && (
        <div className="absolute top-[100%] left-0 w-full bg-neu-dark overflow-hidden shadow-[0_15px_30px_rgba(0,0,0,0.8)] border border-t-0 border-neu-accent rounded-b-xl animate-in fade-in slide-in-from-top-1 duration-200 z-10 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/5">
          <div className="max-h-60 overflow-y-auto w-full custom-scrollbar pb-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-3 text-sm transition-colors duration-150 flex items-center justify-between group ${
                  value === opt.value
                    ? "bg-neu-accent/10 border-l-[3px] border-neu-accent text-neu-accent font-medium"
                    : "hover:bg-white/[0.03] text-neu-dim hover:text-neu-text border-l-[3px] border-transparent"
                }`}
              >
                <span>{opt.label}</span>
                {value === opt.value && <div className="w-1.5 h-1.5 rounded-full bg-neu-accent shadow-[0_0_8px_rgba(255,107,0,0.8)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
