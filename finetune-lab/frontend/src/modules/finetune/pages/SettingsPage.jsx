import { useState } from "react";
import { Settings, KeyRound, Cloud, Check, Eye, EyeOff, Info } from "lucide-react";
import { useSettings } from "../context/SettingsContext";

const GGUF_METHODS = ["q4_k_m", "q5_k_m", "q8_0", "f16"];

export default function SettingsPage() {
  const { settings, update } = useSettings();
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);

  const flash = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const set = (patch) => {
    update(patch);
    flash();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-4xl font-light text-neu-text tracking-tight">Settings</h1>
        <p className="text-neu-dim/60 font-mono text-[11px] uppercase tracking-[0.25em] mt-2">
          Stored locally in this browser
        </p>
      </div>

      {/* Hugging Face */}
      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <Cloud size={18} className="text-neu-dim" /> Hugging Face
          </h2>
          {saved && <span className="text-[11px] font-mono text-green-500 flex items-center gap-1"><Check size={12} /> Saved</span>}
        </div>
        <div className="neu-section-body space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest flex items-center gap-2">
              <KeyRound size={12} /> Access Token
            </label>
            <div className="neu-trough flex items-center pr-2">
              <input
                type={showToken ? "text" : "password"}
                value={settings.hfToken}
                onChange={(e) => set({ hfToken: e.target.value })}
                placeholder="hf_..."
                className="neu-input bg-transparent shadow-none flex-1"
                autoComplete="off"
              />
              <button onClick={() => setShowToken((s) => !s)} className="text-neu-dim hover:text-neu-text p-2">
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-[11px] text-neu-dim flex items-start gap-1.5">
              <Info size={12} className="mt-0.5 shrink-0" />
              Used only when you push an export to the Hub. Kept in browser localStorage — it is sent to your local backend solely for that request, never logged.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Default Repo Prefix</label>
            <div className="neu-trough">
              <input
                type="text"
                value={settings.defaultRepoPrefix}
                onChange={(e) => set({ defaultRepoPrefix: e.target.value })}
                placeholder="your-username"
                className="neu-input bg-transparent shadow-none"
              />
            </div>
            <p className="text-[11px] text-neu-dim">Prefills the repo id on the export panel (e.g. <span className="font-mono">username/model-name</span>).</p>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-bold text-neu-text">Push repos as private</label>
              <p className="text-[10px] text-neu-dim mt-1">New Hub repos default to private.</p>
            </div>
            <button
              onClick={() => set({ hubPrivate: !settings.hubPrivate })}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${settings.hubPrivate ? "bg-neu-accent" : "bg-neu-dark"}`}
            >
              <div className={`bg-white w-4 h-4 rounded-full transition-transform ${settings.hubPrivate ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Export defaults */}
      <div className="neu-section">
        <div className="neu-section-header">
          <h2 className="flex items-center gap-2 text-neu-text font-bold">
            <Settings size={18} className="text-neu-dim" /> Export Defaults
          </h2>
        </div>
        <div className="neu-section-body">
          <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Default GGUF Quantization</label>
          <div className="flex flex-wrap gap-2 mt-3">
            {GGUF_METHODS.map((q) => (
              <button
                key={q}
                onClick={() => set({ ggufQuant: q })}
                className={`neu-btn px-4 py-2 rounded-xl text-xs font-mono font-bold ${settings.ggufQuant === q ? "text-neu-accent ring-1 ring-neu-accent" : "text-neu-dim"}`}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
