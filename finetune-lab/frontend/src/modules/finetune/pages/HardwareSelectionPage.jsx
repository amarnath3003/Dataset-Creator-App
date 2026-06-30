import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { createTrainingJob } from "../services/trainingApi";
import { modelApi } from "../services/modelApi";
import { hardwareApi } from "../services/hardwareApi";
import { Button } from "../../../components/Button";
import { Cpu, Play, AlertTriangle, CheckCircle2, Server, Clock, Layers } from "lucide-react";

// Reference GPUs used only for VRAM/time estimation when no real GPU is detected.
const AVAILABLE_GPUS = [
  { id: "RTX_3060", name: "RTX 3060", vram: 12, speed: 1 },
  { id: "RTX_4090", name: "RTX 4090", vram: 24, speed: 3.5 },
  { id: "A100", name: "NVIDIA A100", vram: 80, speed: 8 },
  { id: "H100", name: "NVIDIA H100", vram: 80, speed: 12 },
];

export default function HardwareSelectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { modelId, datasetPath, datasetName, trainingConfig } = location.state || {};

  const [gpuOptions, setGpuOptions] = useState(AVAILABLE_GPUS);
  const [detectedCount, setDetectedCount] = useState(0); // real CUDA GPUs
  const [numGpus, setNumGpus] = useState(1);              // GPUs to use (DDP)
  const [selectedGpu, setSelectedGpu] = useState(AVAILABLE_GPUS[0]);
  const [modelData, setModelData] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [launchError, setLaunchError] = useState(null);

  const missingInputs = !modelId || !datasetPath;
  const detected = detectedCount > 0;

  useEffect(() => {
    if (modelId) {
      modelApi.getModelDetails(modelId).then(data => setModelData(data)).catch(console.error);
    }
  }, [modelId]);

  // Detect real GPUs; fall back to the reference list if none/unavailable.
  useEffect(() => {
    hardwareApi.getGpus().then(data => {
      const real = (data.gpus || []).filter(g => g.vram_total > 0);
      if (real.length > 0) {
        const opts = real.map(g => ({
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
    }).catch(() => {});
  }, []);

  // VRAM & Time Estimation Engine
  const estimation = useMemo(() => {
    if (!modelData || !trainingConfig) return { vram: 0, time: "Calculating...", fits: true };

    // Base VRAM is the registry's 4-bit minimum; scale by method/precision.
    let estVram = modelData.min_vram;

    // QLoRA/SFT/CPT load the 4-bit base; LoRA the 16-bit base; Full is heaviest.
    const MODE_MULTIPLIER = {
      qlora: 1.0,
      sft: 1.0,
      lora: 2.0,
      cpt: 1.3,
      vision: 2.5,
      full: 4.0,
    };
    estVram *= MODE_MULTIPLIER[trainingConfig.training_type] ?? 1.0;

    // Adjust based on batch size and context
    const batchMultiplier = (trainingConfig.batch_size * trainingConfig.max_seq_length) / 8192;
    estVram += batchMultiplier;

    // Estimate time — DDP replicates the model per GPU (per-GPU VRAM unchanged)
    // but ~scales throughput with the GPU count.
    const baseHours = 2 * (estVram / 8);
    const finalHours = baseHours / selectedGpu.speed / Math.max(1, numGpus);

    return {
      vram: parseFloat(estVram.toFixed(1)),
      time: finalHours < 1 ? `${Math.round(finalHours * 60)} mins` : `${finalHours.toFixed(1)} hours`,
      fits: estVram <= selectedGpu.vram,
    };
  }, [modelData, trainingConfig, selectedGpu, numGpus]);

  const launchTraining = async () => {
    if (missingInputs) {
      setLaunchError("Pick a base model and a dataset before launching.");
      return;
    }
    setIsSubmitting(true);
    setLaunchError(null);
    try {
      const job = await createTrainingJob({
        model_name: modelId,
        dataset_path: datasetPath,
        training_type: trainingConfig?.training_type || "sft",
        num_gpus: numGpus,
        hyperparameters: trainingConfig || {},
      });
      navigate(`/finetune/runs/${job.job_id}`);
    } catch (err) {
      console.error("Failed to start training:", err);
      setLaunchError(err?.response?.data?.detail || err.message || "Failed to start training.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Cpu size={18} className="text-neu-dim" />
          Hardware & Execution
        </h2>
        <div className="led led-on"></div>
      </div>
      
      <div className="neu-section-body space-y-8">
        
        {/* GPU Selection Grid */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Server size={14} className="text-neu-accent" />
            {detected ? 'Detected GPUs' : 'Reference GPUs (estimate only)'}
          </h3>
          {!detected && (
            <p className="text-[11px] font-mono text-neu-dim">
              No CUDA GPU detected by the backend — showing reference cards for estimation. Training runs on the server's actual hardware.
            </p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {gpuOptions.map(gpu => (
              <div
                key={gpu.id}
                onClick={() => setSelectedGpu(gpu)}
                className={`relative neu-plate p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${selectedGpu.id === gpu.id ? 'ring-2 ring-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.2)]' : 'hover:-translate-y-1'}`}
              >
                <Cpu size={24} className={selectedGpu.id === gpu.id ? 'text-neu-accent' : 'text-neu-dim'} />
                <div className="text-center mt-2">
                  <div className="font-bold text-neu-text text-sm">{gpu.name}</div>
                  <div className="text-[10px] text-neu-dim font-mono mt-1">{gpu.vram} GB VRAM</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Parallelism / Multi-GPU */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Layers size={14} className="text-neu-accent" />
            Parallelism
          </h3>
          <div className="neu-plate p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-sm font-bold text-neu-text">Multi-GPU (DDP)</div>
              <p className="text-[11px] text-neu-dim mt-1">
                {detected
                  ? `${detectedCount} CUDA GPU${detectedCount > 1 ? 's' : ''} detected. Using more launches distributed training via accelerate.`
                  : 'Multi-GPU needs the backend to detect CUDA GPUs. Single GPU will be used.'}
              </p>
            </div>
            <div className="flex gap-2">
              {Array.from({ length: Math.max(detectedCount, 1) }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  disabled={n > Math.max(detectedCount, 1)}
                  onClick={() => setNumGpus(n)}
                  className={`neu-btn px-4 py-2 rounded-xl text-sm font-bold transition-all ${numGpus === n ? 'text-neu-accent ring-1 ring-neu-accent' : 'text-neu-dim'} ${n > Math.max(detectedCount, 1) ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          {numGpus > 1 && (
            <p className="text-[11px] font-mono text-neu-dim">
              DDP replicates the model on each GPU — per-GPU VRAM is unchanged, throughput scales with GPU count.
            </p>
          )}
        </div>

        {/* Estimation Engine Panel */}
        <div className="space-y-4">
           <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Clock size={14} className="text-neu-accent" />
            Estimator Analysis
          </h3>
          <div className="neu-plate p-6 rounded-2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Requirements */}
              <div className="space-y-6">
                <div>
                   <div className="text-[10px] text-neu-dim uppercase tracking-widest mb-1">Target Model</div>
                   <div className="text-lg font-bold text-neu-text">{modelData ? modelData.name : (modelId || "Unknown Model")}</div>
                </div>
                <div>
                   <div className="text-[10px] text-neu-dim uppercase tracking-widest mb-1">Engine Mode</div>
                   <div className="text-lg font-bold text-neu-text uppercase">{trainingConfig?.training_type || "QLoRA"}</div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <div className="text-[10px] text-neu-dim uppercase tracking-widest mb-1">Batch / Seq</div>
                    <div className="font-bold text-neu-text">{trainingConfig?.batch_size || 2} / {trainingConfig?.max_seq_length || 2048}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-neu-dim uppercase tracking-widest mb-1">Est. Time</div>
                    <div className="font-bold text-neu-text">{estimation.time}</div>
                  </div>
                </div>
              </div>

              {/* VRAM Gauge */}
              <div className="flex flex-col items-center justify-center p-6 border-l border-white/5">
                <div className="relative flex items-center justify-center w-32 h-32">
                   <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                     <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                     <circle 
                       cx="50" cy="50" r="40" fill="transparent" 
                       stroke={estimation.fits ? "#FF6B00" : "#EF4444"} 
                       strokeWidth="8" 
                       strokeDasharray={`${Math.min((estimation.vram / selectedGpu.vram) * 251, 251)} 251`}
                       className="transition-all duration-1000 ease-out"
                     />
                   </svg>
                   <div className="absolute flex flex-col items-center">
                     <span className={`text-2xl font-bold ${!estimation.fits && 'text-red-500'}`}>{estimation.vram}</span>
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
                      <AlertTriangle size={16} /> Out of Memory (OOM) Risk
                    </div>
                  )}
                  <div className="text-[10px] text-neu-dim mt-2 max-w-[200px]">
                    Selected {selectedGpu.name} provides {selectedGpu.vram} GB. {estimation.fits ? "You have headroom." : "Reduce batch size, sequence length, or use QLoRA."}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* Run summary */}
        <div className="neu-trough p-4 rounded-xl flex flex-wrap gap-x-8 gap-y-2 text-[11px] font-mono text-neu-dim">
          <span>MODEL: <span className="text-neu-text">{modelId || '—'}</span></span>
          <span>DATASET: <span className="text-neu-text">{datasetName || '—'}</span></span>
          <span>MODE: <span className="text-neu-text uppercase">{trainingConfig?.training_type || 'sft'}</span></span>
          <span>GPUS: <span className="text-neu-text">{numGpus}</span></span>
        </div>

        {(launchError || missingInputs) && (
          <div className="neu-alert-warn">
            <AlertTriangle size={16} />
            <span>{launchError || 'Missing model or dataset — go back and complete the earlier steps.'}</span>
          </div>
        )}

        {!estimation.fits && !missingInputs && (
          <div className="neu-alert-info">
            <AlertTriangle size={16} />
            <span>Estimated VRAM exceeds the selected card. You can still launch — the engine auto-falls back on OOM — but expect slower training.</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => window.history.back()} variant="outline" size="lg">
            Back
          </Button>

          <button
            onClick={launchTraining}
            disabled={isSubmitting || missingInputs}
            className={`neu-btn-primary px-8 py-3 flex items-center gap-2 font-bold uppercase tracking-widest text-sm rounded-[24px] ${(isSubmitting || missingInputs) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Play size={16} fill="currentColor" />
            {isSubmitting ? 'Initializing Job...' : 'Launch Training Run'}
          </button>
        </div>
      </div>
    </div>
  );
}
