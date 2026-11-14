import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { hardwareApi } from "../services/hardwareApi";
import { Button } from "../../../components/Button";
import { Cpu, AlertTriangle, CheckCircle2, Server, Clock, Layers, WifiOff } from "lucide-react";
import { useWizard } from "../context/WizardContext";
import { useToast } from "../../../components/Toast";

const MODE_MULTIPLIER = { qlora: 1.0, sft: 1.0, lora: 2.0, cpt: 1.3, vision: 2.5, full: 4.0 };

export default function HardwareSelectionPage() {
  const navigate = useNavigate();
  const { draft, update } = useWizard();
  const { modelId, modelData, datasetPath, datasetRows, trainingConfig } = draft;
  const toast = useToast();

  const [gpuOptions, setGpuOptions] = useState([]);
  const [detectedCount, setDetectedCount] = useState(0);
  const [numGpus, setNumGpus] = useState(draft.numGpus || 1);
  const [selectedGpu, setSelectedGpu] = useState(null);
  const [loadingGpus, setLoadingGpus] = useState(true);
  const [hwError, setHwError] = useState(null);
  const [serverEst, setServerEst] = useState(null);

  const missingInputs = !modelId || !datasetPath;
  const detected = detectedCount > 0;

  useEffect(() => {
    hardwareApi
      .getGpus()
      .then((data) => {
        if (data.error) {
          setHwError(data.error);
          toast.error(`GPU detection failed: ${data.error}`);
        }
        const real = (data.gpus || []).filter((g) => g.vram_total > 0);
        const refs = (data.reference_gpus || []).filter((g) => g.vram_total > 0);
        const combined = [...real, ...refs];
        const opts = combined.map((g) => ({
          id: String(g.id),
          name: g.name,
          vram: Math.max(1, Math.round(g.vram_total / 1024)),
          speed: 1,
          real: !g.is_reference,
          isReference: Boolean(g.is_reference),
        }));
        setGpuOptions(opts);
        setSelectedGpu(opts[0] || null);
        setDetectedCount(real.length);
      })
      .catch((err) => {
        const msg = err?.message || "Can't reach the backend.";
        setHwError(msg);
        toast.error(`Can't reach the backend - is it running on :8001? ${msg}`);
      })
      .finally(() => setLoadingGpus(false));
  }, [toast]);

  useEffect(() => {
    update({ numGpus, selectedGpuName: selectedGpu?.name || null });
  }, [numGpus, selectedGpu, update]);

  useEffect(() => {
    if (!modelId || !selectedGpu || !trainingConfig) {
      setServerEst(null);
      return;
    }
    let cancelled = false;
    hardwareApi
      .estimate({
        model_name: modelData?.name || modelId,
        dataset_size: datasetRows || 1000,
        training_method: trainingConfig.training_type || "qlora",
        batch_size: trainingConfig.batch_size || 2,
        seq_length: trainingConfig.max_seq_length || 2048,
        lora_rank: trainingConfig.lora_rank || 16,
        epochs: trainingConfig.epochs || 3,
        grad_accum: trainingConfig.gradient_accumulation || 4,
        gpu_vram_gb: selectedGpu.vram || 24,
      })
      .then((res) => {
        if (!cancelled) setServerEst(res);
      })
      .catch(() => {
        if (!cancelled) setServerEst(null);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, modelData, datasetRows, trainingConfig, selectedGpu]);

  const estimation = useMemo(() => {
    if (!modelData || !trainingConfig || !selectedGpu) return { vram: 0, time: "-", fits: true };
    if (serverEst && typeof serverEst.estimated_vram_gb === "number") {
      const mins = serverEst.estimated_minutes || 1;
      return {
        vram: serverEst.estimated_vram_gb,
        time: mins < 60 ? `${mins} mins` : `${(mins / 60).toFixed(1)} hours`,
        fits: Boolean(serverEst.fits),
        weights_gb: serverEst.weights_gb,
        adapter_grad_gb: serverEst.adapter_grad_gb,
        activations_gb: serverEst.activations_gb,
      };
    }
    let estVram = (modelData.min_vram || 6) * (MODE_MULTIPLIER[trainingConfig.training_type] ?? 1.0);
    estVram += (trainingConfig.batch_size * trainingConfig.max_seq_length) / 8192;
    const baseHours = 2 * (estVram / 8);
    const finalHours = baseHours / selectedGpu.speed / Math.max(1, numGpus);
    return {
      vram: parseFloat(estVram.toFixed(1)),
      time: finalHours < 1 ? `${Math.round(finalHours * 60)} mins` : `${finalHours.toFixed(1)} hours`,
      fits: estVram <= selectedGpu.vram,
    };
  }, [modelData, trainingConfig, selectedGpu, numGpus, serverEst]);

  return (
    <div className="neu-section w-full">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Cpu size={18} className="text-neu-dim" />
          Hardware &amp; Parallelism
        </h2>
        <div className="led led-on"></div>
      </div>

      <div className="neu-section-body space-y-8">
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono uppercase tracking-widest text-neu-dim">
          <span className="neu-badge neu-badge-accent">Step 4</span>
          <span>Pick the runtime target and check the fit estimate before launch.</span>
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Server size={14} className="text-neu-accent" />
            Detected GPUs
          </h3>
          {loadingGpus ? (
            <p className="text-[11px] font-mono text-neu-dim">Detecting GPUs on the backend...</p>
          ) : hwError ? (
            <div className="neu-alert-warn flex items-start gap-2">
              <WifiOff size={16} className="shrink-0 mt-0.5" />
              <span className="text-[11px] font-mono">
                Can't reach the backend - is it running on :8001? <span className="text-neu-dim">{hwError}</span>
              </span>
            </div>
          ) : gpuOptions.length === 0 ? (
            <p className="text-[11px] font-mono text-neu-dim">
              No CUDA GPU detected by the backend. Training will fall back to CPU or simulation mode.
            </p>
          ) : (
            <div className="space-y-3">
              {!detected && (
                <p className="text-[11px] font-mono text-neu-dim">
                  No local CUDA GPU active — showing reference GPU profiles for planning &amp; simulation mode.
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gpuOptions.map((gpu) => {
                  const isSelected = selectedGpu?.id === gpu.id;
                  return (
                    <div
                      key={gpu.id}
                      onClick={() => setSelectedGpu(gpu)}
                      className={`group relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] p-4 text-center console-select-card ${
                        isSelected ? "console-select-card-active border-black/40" : "border-white/5"
                      }`}
                    >
                      <div
                        className={`absolute right-4 top-4 h-2 w-2 rounded-full transition-all duration-200 ${
                          isSelected ? "bg-neu-accent shadow-[0_0_10px_rgba(255,107,0,1)]" : "bg-black/40 shadow-[inset_1px_1px_2px_#000]"
                        }`}
                      />
                      <Cpu size={24} className={isSelected ? "text-neu-accent" : "text-neu-dim transition-colors duration-150 group-hover:text-neu-accent"} />
                      <div className="text-center mt-2">
                        <div className={`text-sm font-bold transition-colors duration-150 ${isSelected ? "text-neu-accent" : "text-neu-text group-hover:text-neu-accent"}`}>{gpu.name}</div>
                        <div className="text-[10px] text-neu-dim font-mono mt-1">{gpu.vram} GB VRAM</div>
                        {gpu.isReference ? (
                          <span className="inline-block mt-1.5 text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-neu-dark/70 text-neu-dim border border-white/5">
                            Reference
                          </span>
                        ) : (
                          <span className="inline-block mt-1.5 text-[9px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            Detected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Layers size={14} className="text-neu-accent" /> Parallelism
          </h3>
          <div className="neu-plate p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-neu-text">Multi-GPU (DDP)</div>
              <p className="text-[11px] text-neu-dim mt-1">
                {detected
                  ? `${detectedCount} CUDA GPU${detectedCount > 1 ? "s" : ""} detected. Distributed training will launch through accelerate when you pick more than one GPU.`
                  : "Multi-GPU needs the backend to detect CUDA GPUs. Single GPU will be used."}
              </p>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: Math.max(detectedCount, 1) }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  disabled={n > Math.max(detectedCount, 1)}
                  onClick={() => setNumGpus(n)}
                  className={`neu-btn px-4 py-2 rounded-xl text-sm font-bold transition-all ${numGpus === n ? "text-neu-accent ring-1 ring-neu-accent" : "text-neu-dim"} ${
                    n > Math.max(detectedCount, 1) ? "opacity-30 cursor-not-allowed" : ""
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>

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
              {estimation.weights_gb != null && (
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-[11px] font-mono">
                  <div className="neu-trough p-2 rounded-lg text-center">
                    <div className="text-[9px] text-neu-dim uppercase">Weights</div>
                    <div className="text-neu-text font-bold">{estimation.weights_gb} GB</div>
                  </div>
                  <div className="neu-trough p-2 rounded-lg text-center">
                    <div className="text-[9px] text-neu-dim uppercase">LoRA/Optim</div>
                    <div className="text-neu-text font-bold">{estimation.adapter_grad_gb} GB</div>
                  </div>
                  <div className="neu-trough p-2 rounded-lg text-center">
                    <div className="text-[9px] text-neu-dim uppercase">Activations</div>
                    <div className="text-neu-text font-bold">{estimation.activations_gb} GB</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-col items-center justify-center p-6 border-l border-white/5">
              <div className="relative flex items-center justify-center w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="transparent"
                    stroke={estimation.fits ? "#FF6B00" : "#EF4444"}
                    strokeWidth="8"
                    strokeDasharray={`${Math.min((estimation.vram / (selectedGpu?.vram || 1)) * 251, 251)} 251`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className={`text-2xl font-bold ${!estimation.fits && "text-red-500"}`}>{estimation.vram}</span>
                  <span className="text-[10px] text-neu-dim">GB VRAM</span>
                </div>
              </div>
              <div className="mt-6 text-center">
                {estimation.fits ? (
                  <div className="flex items-center gap-2 text-green-500 text-sm font-bold">
                    <CheckCircle2 size={16} /> Compute Sufficient
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-500 text-sm font-bold">
                    <AlertTriangle size={16} /> OOM Risk
                  </div>
                )}
                <div className="text-[10px] text-neu-dim mt-2 max-w-[200px]">
                  {selectedGpu ? (
                    <>
                      {selectedGpu.name} provides {selectedGpu.vram} GB. {estimation.fits ? "You have headroom." : "Reduce batch/seq, or use QLoRA."}
                    </>
                  ) : (
                    "No GPU selected - estimate unavailable."
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {missingInputs && (
          <div className="neu-alert-warn">
            <AlertTriangle size={16} />
            <span>Missing model or dataset - go back and complete the earlier steps.</span>
          </div>
        )}

        <div className="flex justify-between items-center gap-3 pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => navigate("/finetune/new/config")} variant="outline" size="lg" className="min-w-[152px]">
            Back
          </Button>
          <Button
            onClick={() => navigate("/finetune/new/review")}
            variant="primary"
            size="lg"
            disabled={missingInputs}
            className={`min-w-[208px] ${missingInputs ? "opacity-50 cursor-not-allowed" : ""}`}
          >
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
