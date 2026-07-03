import { useState } from "react";
import { Settings, KeyRound, Cloud, Check, Eye, EyeOff, Info, HardDrive } from "lucide-react";
import { useSettings } from "../context/SettingsContext";
import { Toggle } from "../../../components/Toggle";
import { ConsoleSection, MetricCard, PageHero } from "../components/ConsolePage";

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
    <div className="space-y-8 max-w-5xl">
      <PageHero
        title="Settings"
        description="Stored locally in this browser"
        badge={
          <span className="font-mono text-xs text-neu-accent tracking-widest font-bold uppercase">
            {saved ? "Saved" : "Local defaults"}
          </span>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <MetricCard icon={Cloud} label="Hub Visibility" value={settings.hubPrivate ? "Private" : "Public"} hint="Default repo mode" accent={settings.hubPrivate} />
        <MetricCard icon={HardDrive} label="GGUF Quant" value={settings.ggufQuant} hint="Default export format" />
        <MetricCard icon={Settings} label="Repo Prefix" value={settings.defaultRepoPrefix || "-"} hint="Prefill for Hub exports" />
      </div>

      <ConsoleSection
        title="Hugging Face"
        icon={Cloud}
        badge="Token and release defaults"
        action={saved ? <span className="text-[11px] font-mono text-green-500 flex items-center gap-1"><Check size={12} /> Saved</span> : null}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-8">
          <div className="space-y-6">
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
                Used only when pushing an export to the Hub. Kept in browser localStorage and sent only for that export request.
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
              <p className="text-[11px] text-neu-dim">
                Prefills the repo id on the export panel, for example <span className="font-mono">username/model-name</span>.
              </p>
            </div>
          </div>

          <div className="neu-plate p-6 rounded-2xl space-y-4">
            <div className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Publish Mode</div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-bold text-neu-text">Push repos as private</label>
                <p className="text-[10px] text-neu-dim mt-1">New Hub repos default to private.</p>
              </div>
              <Toggle on={settings.hubPrivate} onClick={() => set({ hubPrivate: !settings.hubPrivate })} />
            </div>
          </div>
        </div>
      </ConsoleSection>

      <ConsoleSection title="Export Defaults" icon={Settings} badge="GGUF baseline">
        <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">Default GGUF Quantization</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {GGUF_METHODS.map((q) => (
            <button
              key={q}
              onClick={() => set({ ggufQuant: q })}
              className={`neu-plate px-4 py-4 rounded-2xl text-xs font-mono font-bold uppercase tracking-widest transition-all ${
                settings.ggufQuant === q ? "text-neu-accent ring-1 ring-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.15)]" : "text-neu-dim"
              }`}
            >
              {q}
            </button>
          ))}
        </div>
      </ConsoleSection>
    </div>
  );
}
