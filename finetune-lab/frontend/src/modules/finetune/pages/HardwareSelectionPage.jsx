import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { hardwareApi } from "../services/hardwareApi";
import { Button } from "../../../components/Button";
import { Cpu, AlertTriangle, CheckCircle2, Server, Clock, Layers } from "lucide-react";
import { useWizard } from "../context/WizardContext";

// Reference GPUs used only for VRAM/time estimation when no real GPU is detected.
const AVAILABLE_GPUS = [
  { id: "RTX_3060", name: "RTX 3060", vram: 12, speed: 1 },
  { id: "RTX_4090", name: "RTX 4090", vram: 24, speed: 3.5 },
  { id: "A100", name: "NVIDIA A100", vram: 80, speed: 8 },
  { id: "H100", name: "NVIDIA H100", vram: 80, speed: 12 },
];

const MODE_MULTIPLIER = { qlora: 1.0, sft: 1.0, lora: 2.0, cpt: 1.3, vision: 2.5, full: 4.0 };

export default function HardwareSelectionPage() {
  const navigate = useNavigate();
  const { draft, update } = useWizard();
  const { modelId, modelData, datasetPath, trainingConfig } = draft;

  const [gpuOptions, setGpuOptions] = useState(AVAILABLE_GPUS);
  const [detectedCount, setDetectedCount] = useState(0);
  const [numGpus, setNumGpus] = useState(draft.numGpus || 1);
  const [selectedGpu, setSelectedGpu] = useState(AVAILABLE_GPUS[0]);

  const missingInputs = !modelId || !datasetPath;
  const detected = detectedCount > 0;

  useEffect(() => {
    hardwareApi
      .getGpus()
      .then((data) => {
        const real = (data.gpus || []).filter((g) => g.vram_total > 0);
        if (real.length > 0) {
          const opts = real.map((g) => ({
            id: String(g.id),
            name: g.name,
            vram: Math.max(1, Math.round(g.vram_total / 1024)),
            speed: 1,
            real: true,
          }));
          setGpuOptions(opts);
          setSelectedGpu(opts[0]);
          setDetectedCount(real.length);
        }
      })
      .catch(() => {});
  }, []);

  // Persist the parallelism choice into the draft as it changes.
  useEffect(() => {
    update({ numGpus, selectedGpuName: selectedGpu?.name });
  }, [numGpus, selectedGpu, update]);

  const estimation = useMemo(() => {
    if (!modelData || !trainingConfig) return { vram: 0, time: "—", fits: true };
    let estVram = (modelData.min_vram || 6) * (MODE_MULTIPLIER[trainingConfig.training_type] ?? 1.0);
    estVram += (trainingConfig.batch_size * trainingConfig.max_seq_length) / 8192;
    const baseHours = 2 * (estVram / 8);
    const finalHours = baseHours / selectedGpu.speed / Math.max(1, numGpus);
    return {
      vram: parseFloat(estVram.toFixed(1)),
      time: finalHours < 1 ? `${Math.round(finalHours * 60)} mins` : `${finalHours.toFixed(1)} hours`,
      fits: estVram <= selectedGpu.vram,
    };
  }, [modelData, trainingConfig, selectedGpu, numGpus]);

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Cpu size={18} className="text-neu-dim" />
          Hardware &amp; Parallelism
        </h2>
        <div className="led led-on"></div>
      </div>

      <div className="neu-section-body space-y-8">
        {/* GPU selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Server size={14} className="text-neu-accent" />
            {detected ? "Detected GPUs" : "Reference GPUs (estimate only)"}
          </h3>
          {!detected && (
            <p className="text-[11px] font-mono text-neu-dim">
              No CUDA GPU detected by the backend — showing reference cards for estimation. Training runs on the server's actual hardware.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gpuOptions.map((gpu) => (
              <div
                key={gpu.id}
                onClick={() => setSelectedGpu(gpu)}
                className={`relative neu-plate p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${selectedGpu.id === gpu.id ? "ring-2 ring-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.2)]" : "hover:-translate-y-1"}`}
              >
                <Cpu size={24} className={selectedGpu.id === gpu.id ? "text-neu-accent" : "text-neu-dim"} />
                <div className="text-center mt-2">
                  <div className="font-bold text-neu-text text-sm">{gpu.name}</div>
                  <div className="text-[10px] text-neu-dim font-mono mt-1">{gpu.vram} GB VRAM</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Parallelism */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Layers size={14} className="text-neu-accent" /> Parallelism
          </h3>
          <div className="neu-plate p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-neu-text">Multi-GPU (DDP)</div>
              <p className="text-[11px] text-neu-dim mt-1">
                {detected
                  ? `${detectedCount} CUDA GPU${detectedCount > 1 ? "s" : ""} detected. Using more launches distributed training via accelerate.`
                  : "Multi-GPU needs the backend to detect CUDA GPUs. Single GPU will be used."}
              </p>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: Math.max(detectedCount, 1) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  disabled={n > Math.max(detectedCount, 1)}
                  onClick={() => setNumGpus(n)}
                  className={`neu-btn px-4 py-2 rounded-xl text-sm font-bold transition-all ${numGpus === n ? "text-neu-accent ring-1 ring-neu-accent" : "text-neu-dim"} ${n > Math.max(detectedCount, 1) ? "opacity-30 cursor-not-allowed" : ""}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Estimator */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Clock size={14} className="text-neu-accent" /> Estimator Analysis
          </h3>
          <div className="neu-plate p-6 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <Stat label="Target Model" value={modelData ? modelData.name : modelId || "Unknown"} />
              <Stat label="Engine Mode" value={(trainingConfig?.training_type || "qlora").toUpperCase()} />
              <div className="flex gap-6">
                <Stat label="Batch / Seq" value={`${trainingConfig?.batch_size ?? 2} / ${trainingConfig?.max_seq_length ?? 2048}`} />
                <Stat label="Est. Time" value={estimation.time} />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-6 border-l border-white/5">
              <div className="relative flex items-center justify-center w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke={estimation.fits ? "#FF6B00" : "#EF4444"} strokeWidth="8" strokeDasharray={`${Math.min((estimation.vram / selectedGpu.vram) * 251, 251)} 251`} className="transition-all duration-1000 ease-out" />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className={`text-2xl font-bold ${!estimation.fits && "text-red-500"}`}>{estimation.vram}</span>
                  <span className="text-[10px] text-neu-dim">GB VRAM</span>
                </div>
              </div>
              <div className="mt-6 text-center">
                {estimation.fits ? (
                  <div className="flex items-center gap-2 text-green-500 text-sm font-bold"><CheckCircle2 size={16} /> Compute Sufficient</div>
                ) : (
                  <div className="flex items-center gap-2 text-red-500 text-sm font-bold"><AlertTriangle size={16} /> OOM Risk</div>
                )}
                <div className="text-[10px] text-neu-dim mt-2 max-w-[200px]">
                  {selectedGpu.name} provides {selectedGpu.vram} GB. {estimation.fits ? "You have headroom." : "Reduce batch/seq, or use QLoRA."}
                </div>
              </div>
            </div>
          </div>
        </div>

        {missingInputs && (
          <div className="neu-alert-warn">
            <AlertTriangle size={16} />
            <span>Missing model or dataset — go back and complete the earlier steps.</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => navigate("/finetune/new/config")} variant="outline" size="lg">Back</Button>
          <Button onClick={() => navigate("/finetune/new/review")} variant="primary" size="lg" disabled={missingInputs} className={missingInputs ? "opacity-50 cursor-not-allowed" : ""}>
            Next: Review &amp; Launch
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="text-[10px] text-neu-dim uppercase tracking-widest mb-1">{label}</div>
      <div className="text-lg font-bold text-neu-text">{value}</div>
    </div>
  );
}
