import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Settings, Sliders, Cpu, Zap, Box, Wand2, ChevronDown, ChevronRight } from "lucide-react";
import { useWizard } from "../context/WizardContext";

const ALL_METHODS = [
  { id: "qlora", label: "QLoRA", desc: "4-bit base + LoRA · lowest VRAM" },
  { id: "lora", label: "LoRA", desc: "16-bit base + LoRA · higher quality" },
  { id: "sft", label: "SFT", desc: "Supervised tuning (4-bit LoRA)" },
  { id: "full", label: "Full", desc: "All parameters (high VRAM)" },
  { id: "cpt", label: "CPT", desc: "Continued pre-training" },
  { id: "vision", label: "Vision", desc: "Multimodal VLM" },
];

const SCHEDULERS = ["cosine", "linear", "constant", "polynomial"];
const OPTIMIZERS = ["paged_adamw_8bit", "adamw_8bit", "adamw_torch", "adafactor"];

function parseParams(modelData) {
  const raw = modelData?.parameters || "";
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 7;
}

// Heuristic "Smart Config": pick sensible knobs from the model size + modality.
function recommend(modelData) {
  const isVision = modelData?.modality === "vision" || (modelData?.supports || []).includes("vision");
  const params = parseParams(modelData);
  const method = isVision ? "vision" : "qlora";
  const rank = params <= 8 ? 16 : 32;
  const batch = params <= 3 ? 4 : params <= 8 ? 2 : 1;
  const grad = Math.max(1, Math.round(16 / batch)); // target effective batch ~16
  return {
    training_type: method,
    lora_rank: rank,
    lora_alpha: rank,
    lora_dropout: 0.05,
    batch_size: batch,
    gradient_accumulation: grad,
    max_seq_length: 2048,
    learning_rate: 2e-4,
    epochs: 3,
    packing: false,
    use_rslora: params > 8,
  };
}

function Toggle({ on, onClick }) {
  return (
    <button onClick={onClick} className={`w-12 h-6 rounded-full p-1 transition-colors ${on ? "bg-neu-accent" : "bg-neu-dark"}`}>
      <div className={`bg-white w-4 h-4 rounded-full transition-transform ${on ? "translate-x-6" : "translate-x-0"}`} />
    </button>
  );
}

export default function TrainingConfigPage() {
  const navigate = useNavigate();
  const { draft, updateConfig } = useWizard();
  const config = draft.trainingConfig;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smartApplied, setSmartApplied] = useState(false);

  const handleUpdate = (field, value) => updateConfig({ [field]: value });

  // Restrict method cards to what the chosen registry model supports. HF/local
  // models (no metadata) get the full list.
  const supported = draft.modelData?.supports;
  const methods = supported ? ALL_METHODS.filter((m) => supported.includes(m.id)) : ALL_METHODS;

  const applySmart = () => {
    updateConfig(recommend(draft.modelData));
    setSmartApplied(true);
    setTimeout(() => setSmartApplied(false), 1800);
  };

  const setMethod = (id) => {
    updateConfig({ training_type: id, ...(id === "cpt" ? { packing: true } : {}) });
  };

  const effBatch = (config.batch_size || 1) * (config.gradient_accumulation || 1);

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Settings size={18} className="text-neu-dim" />
          Hyperparameters &amp; Mode
        </h2>
        <div className="led led-on"></div>
      </div>

      <div className="neu-section-body space-y-8">
        {/* Smart Config banner */}
        <div className="neu-plate p-4 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl neu-inset flex items-center justify-center text-neu-accent">
              <Wand2 size={18} />
            </div>
            <div>
              <div className="text-sm font-bold text-neu-text">Smart Config</div>
              <p className="text-[11px] text-neu-dim">Auto-tune method, rank, batch &amp; grad-accum for <span className="font-mono">{draft.modelData?.name || draft.modelId || "this model"}</span>.</p>
            </div>
          </div>
          <button onClick={applySmart} className="neu-btn-primary px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest shrink-0">
            {smartApplied ? "Applied ✓" : "Apply"}
          </button>
        </div>

        {/* Training Mode Selection */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
            <Cpu size={14} className="text-neu-accent" />
            Training Engine Mode
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {methods.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setMethod(mode.id)}
                className={`neu-plate p-4 rounded-xl text-left transition-all duration-300 border-2 ${config.training_type === mode.id ? "border-neu-accent shadow-[0_0_15px_rgba(255,107,0,0.1)]" : "border-transparent hover:border-neu-dim/20"}`}
              >
                <div className="font-bold text-neu-text">{mode.label}</div>
                <div className="text-[10px] text-neu-dim mt-1">{mode.desc}</div>
              </button>
            ))}
          </div>

          {["sft", "lora", "qlora"].includes(config.training_type) && (
            <p className="text-[11px] font-mono text-neu-dim">
              Base precision: <span className="text-neu-accent">{config.training_type === "lora" ? "16-bit" : "4-bit"}</span>
              {config.training_type === "lora"
                ? " — loads the full-precision checkpoint (more VRAM, higher fidelity)."
                : " — quantized base (lowest VRAM)."}
            </p>
          )}
          {config.training_type === "full" && (
            <p className="text-[11px] font-mono text-neu-dim">
              Base precision: <span className="text-neu-accent">16-bit</span> — full-parameter fine-tuning (no LoRA). Highest quality &amp; VRAM.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Core hyperparameters */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
              <Zap size={14} className="text-neu-accent" />
              Core Hyperparameters
            </h3>
            <div className="neu-plate p-6 rounded-2xl space-y-4">
              <Field label="Epochs">
                <input type="number" value={config.epochs} onChange={(e) => handleUpdate("epochs", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
              </Field>
              <Field label="Learning Rate">
                <input type="number" step="0.00001" value={config.learning_rate} onChange={(e) => handleUpdate("learning_rate", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Batch Size">
                  <input type="number" value={config.batch_size} onChange={(e) => handleUpdate("batch_size", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                </Field>
                <Field label="Grad Accum">
                  <input type="number" value={config.gradient_accumulation} onChange={(e) => handleUpdate("gradient_accumulation", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                </Field>
              </div>
              <p className="text-[10px] font-mono text-neu-dim">Effective batch size: <span className="text-neu-accent">{effBatch}</span></p>
              <Field label="Max Seq Length">
                <input type="number" step="512" value={config.max_seq_length} onChange={(e) => handleUpdate("max_seq_length", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
              </Field>
            </div>

            {/* Advanced (collapsible) */}
            <button onClick={() => setShowAdvanced((s) => !s)} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-neu-dim hover:text-neu-text">
              {showAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />} Advanced Optimizer &amp; Schedule
            </button>
            {showAdvanced && (
              <div className="neu-plate p-6 rounded-2xl space-y-4 animate-in fade-in duration-200">
                <Field label="LR Scheduler">
                  <select value={config.lr_scheduler_type} onChange={(e) => handleUpdate("lr_scheduler_type", e.target.value)} className="neu-input bg-transparent shadow-none">
                    {SCHEDULERS.map((s) => <option key={s} value={s} className="bg-neu-dark">{s}</option>)}
                  </select>
                </Field>
                <Field label="Optimizer">
                  <select value={config.optim} onChange={(e) => handleUpdate("optim", e.target.value)} className="neu-input bg-transparent shadow-none">
                    {OPTIMIZERS.map((o) => <option key={o} value={o} className="bg-neu-dark">{o}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Warmup Ratio">
                    <input type="number" step="0.01" value={config.warmup_ratio} onChange={(e) => handleUpdate("warmup_ratio", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                  </Field>
                  <Field label="Weight Decay">
                    <input type="number" step="0.01" value={config.weight_decay} onChange={(e) => handleUpdate("weight_decay", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Save Steps">
                    <input type="number" step="50" value={config.save_steps} onChange={(e) => handleUpdate("save_steps", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                  </Field>
                  <Field label="Seed">
                    <input type="number" value={config.seed} onChange={(e) => handleUpdate("seed", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                  </Field>
                </div>
              </div>
            )}

            {/* SFT / CPT dataset config */}
            <div className={`space-y-4 transition-opacity duration-300 ${["sft", "cpt"].includes(config.training_type) ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2 mt-6">
                <Box size={14} className="text-neu-accent" /> Dataset Config
              </h3>
              <div className="neu-plate p-6 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-neu-text">Sequence Packing</label>
                    <p className="text-[10px] text-neu-dim mt-1">Accelerates training for short sequences (up to 5×)</p>
                  </div>
                  <Toggle on={config.packing} onClick={() => handleUpdate("packing", !config.packing)} />
                </div>
                {config.training_type === "cpt" && (
                  <>
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <div>
                        <label className="text-sm font-bold text-neu-text">Train Embeddings</label>
                        <p className="text-[10px] text-neu-dim mt-1">Also tune embed_tokens + lm_head for new vocabulary</p>
                      </div>
                      <Toggle on={config.train_embeddings} onClick={() => handleUpdate("train_embeddings", !config.train_embeddings)} />
                    </div>
                    <div className={`transition-opacity ${config.train_embeddings ? "" : "opacity-40 pointer-events-none"}`}>
                      <Field label="Embedding Learning Rate">
                        <input type="number" step="0.000001" min="0" value={config.embedding_learning_rate} onChange={(e) => handleUpdate("embedding_learning_rate", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
                      </Field>
                    </div>
                    <p className="text-[10px] text-neu-dim">CPT trains on a raw-text corpus (a <span className="font-mono">text</span> column). Use domain documents, not Q&amp;A pairs.</p>
                  </>
                )}
              </div>
            </div>

            {/* Vision config */}
            {config.training_type === "vision" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2 mt-6">
                  <Box size={14} className="text-neu-accent" /> Vision Config
                </h3>
                <div className="neu-plate p-6 rounded-2xl space-y-4">
                  {[
                    { key: "finetune_vision_layers", label: "Vision Layers", desc: "Tune the image encoder" },
                    { key: "finetune_language_layers", label: "Language Layers", desc: "Tune the text decoder" },
                    { key: "finetune_attention_modules", label: "Attention Modules", desc: "Tune attention projections" },
                    { key: "finetune_mlp_modules", label: "MLP Modules", desc: "Tune feed-forward layers" },
                  ].map((opt) => (
                    <div key={opt.key} className="flex items-center justify-between">
                      <div>
                        <label className="text-sm font-bold text-neu-text">{opt.label}</label>
                        <p className="text-[10px] text-neu-dim mt-1">{opt.desc}</p>
                      </div>
                      <Toggle on={config[opt.key]} onClick={() => handleUpdate(opt.key, !config[opt.key])} />
                    </div>
                  ))}
                  <div className="pt-4 border-t border-white/5">
                    <Field label="Instruction Prompt">
                      <textarea rows={2} value={config.vision_instruction} onChange={(e) => handleUpdate("vision_instruction", e.target.value)} className="neu-textarea bg-transparent shadow-none" />
                    </Field>
                    <p className="text-[10px] text-neu-dim mt-1">Used as the user turn for each image when the dataset has image + text columns.</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Adapter config */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-neu-text tracking-widest uppercase flex items-center gap-2">
              <Sliders size={14} className="text-neu-accent" /> Adapter Configuration
            </h3>
            <div className={`neu-plate p-6 rounded-2xl space-y-6 transition-opacity duration-300 ${["sft", "lora", "qlora", "cpt", "vision"].includes(config.training_type) ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest flex justify-between">
                  <span>LoRA Rank (r)</span><span className="text-neu-accent">{config.lora_rank}</span>
                </label>
                <div className="neu-trough p-3">
                  <input type="range" min="8" max="128" step="8" value={config.lora_rank} onChange={(e) => handleUpdate("lora_rank", Number(e.target.value))} className="w-full accent-neu-accent" />
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest flex justify-between">
                  <span>LoRA Alpha</span><span className="text-neu-accent">{config.lora_alpha}</span>
                </label>
                <div className="neu-trough p-3">
                  <input type="range" min="8" max="256" step="8" value={config.lora_alpha} onChange={(e) => handleUpdate("lora_alpha", Number(e.target.value))} className="w-full accent-neu-accent" />
                </div>
              </div>
              <Field label="LoRA Dropout">
                <input type="number" step="0.01" min="0" max="1" value={config.lora_dropout} onChange={(e) => handleUpdate("lora_dropout", Number(e.target.value))} className="neu-input bg-transparent shadow-none" />
              </Field>
              <div className="pt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold text-neu-text">RSLoRA</label>
                    <p className="text-[10px] text-neu-dim mt-1">Rank-Stabilized LoRA (Unsloth optimized)</p>
                  </div>
                  <Toggle on={config.use_rslora} onClick={() => handleUpdate("use_rslora", !config.use_rslora)} />
                </div>
                <div className={`flex items-center justify-between transition-opacity ${["qlora", "sft"].includes(config.training_type) ? "" : "opacity-40 pointer-events-none"}`}>
                  <div>
                    <label className="text-sm font-bold text-neu-text">LoftQ Initialization</label>
                    <p className="text-[10px] text-neu-dim mt-1">Improves QLoRA accuracy (4-bit only)</p>
                  </div>
                  <Toggle on={config.use_loftq} onClick={() => handleUpdate("use_loftq", !config.use_loftq)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
          <Button onClick={() => navigate("/finetune/new/dataset")} variant="outline" size="lg">Back</Button>
          <Button onClick={() => navigate("/finetune/new/hardware")} variant="primary" size="lg">Next: Hardware</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="flex flex-col space-y-2">
      <label className="text-[10px] font-bold text-neu-dim uppercase tracking-widest">{label}</label>
      <div className="neu-trough">{children}</div>
    </div>
  );
}
