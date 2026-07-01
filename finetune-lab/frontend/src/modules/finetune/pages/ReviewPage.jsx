import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/Button";
import { Rocket, Server, Database, Settings, Cpu, Play, AlertTriangle } from "lucide-react";
import { training } from "../services/finetuneApi";
import { useWizard } from "../context/WizardContext";
import { METHOD_LABEL } from "../lib/format";

// Only forward hyperparameters relevant to the chosen method, so the payload
// stays clean (the backend reads keys defensively regardless).
function relevantHyperparams(cfg) {
  const base = {
    epochs: cfg.epochs,
    learning_rate: cfg.learning_rate,
    batch_size: cfg.batch_size,
    gradient_accumulation: cfg.gradient_accumulation,
    max_seq_length: cfg.max_seq_length,
    save_steps: cfg.save_steps,
    warmup_ratio: cfg.warmup_ratio,
    weight_decay: cfg.weight_decay,
    lr_scheduler_type: cfg.lr_scheduler_type,
    optim: cfg.optim,
    seed: cfg.seed,
    packing: cfg.packing,
  };
  const t = cfg.training_type;
  if (["sft", "lora", "qlora", "cpt", "vision"].includes(t)) {
    Object.assign(base, {
      lora_rank: cfg.lora_rank,
      lora_alpha: cfg.lora_alpha,
      lora_dropout: cfg.lora_dropout,
      use_rslora: cfg.use_rslora,
    });
  }
  if (["sft", "qlora"].includes(t)) base.use_loftq = cfg.use_loftq;
  if (t === "cpt") {
    Object.assign(base, {
      train_embeddings: cfg.train_embeddings,
      embedding_learning_rate: cfg.embedding_learning_rate,
    });
  }
  if (t === "vision") {
    Object.assign(base, {
      finetune_vision_layers: cfg.finetune_vision_layers,
      finetune_language_layers: cfg.finetune_language_layers,
      finetune_attention_modules: cfg.finetune_attention_modules,
      finetune_mlp_modules: cfg.finetune_mlp_modules,
      vision_instruction: cfg.vision_instruction,
    });
  }
  return base;
}

export default function ReviewPage() {
  const navigate = useNavigate();
  const { draft } = useWizard();
  const { modelId, modelData, datasetPath, datasetName, datasetFormat, trainingConfig, numGpus } = draft;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const missing = !modelId || !datasetPath;
  const hp = relevantHyperparams(trainingConfig);

  const launch = async () => {
    if (missing) {
      setError("Pick a base model and a dataset before launching.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const job = await training.create({
        model_name: modelId,
        dataset_path: datasetPath,
        training_type: trainingConfig.training_type,
        num_gpus: numGpus || 1,
        hyperparameters: hp,
      });
      navigate(`/finetune/runs/${job.job_id}`);
    } catch (err) {
      setError(err.message || "Failed to start training.");
      setSubmitting(false);
    }
  };

  return (
    <div className="neu-section max-w-4xl mx-auto">
      <div className="neu-section-header">
        <h2 className="flex items-center gap-2 text-neu-text font-bold">
          <Rocket size={18} className="text-neu-dim" /> Review &amp; Launch
        </h2>
        <div className="led led-on"></div>
      </div>

      <div className="neu-section-body space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SummaryCard icon={Server} title="Model">
            <div className="text-neu-text font-bold">{modelData?.name || modelId || "—"}</div>
            <div className="text-[11px] font-mono text-neu-dim break-all">{modelId}</div>
          </SummaryCard>
          <SummaryCard icon={Database} title="Dataset">
            <div className="text-neu-text font-bold break-all">{datasetName || "—"}</div>
            <div className="text-[11px] font-mono text-neu-dim uppercase tracking-widest">{datasetFormat || ""}</div>
          </SummaryCard>
          <SummaryCard icon={Settings} title="Method">
            <div className="text-neu-text font-bold uppercase">{METHOD_LABEL[trainingConfig.training_type] || trainingConfig.training_type}</div>
            <div className="text-[11px] font-mono text-neu-dim">
              eff. batch {trainingConfig.batch_size * trainingConfig.gradient_accumulation} · {trainingConfig.epochs} epochs
            </div>
          </SummaryCard>
          <SummaryCard icon={Cpu} title="Hardware">
            <div className="text-neu-text font-bold">{draft.selectedGpuName || "Server GPU"}</div>
            <div className="text-[11px] font-mono text-neu-dim">{numGpus > 1 ? `${numGpus} GPUs · DDP` : "single GPU"}</div>
          </SummaryCard>
        </div>

        {/* Full hyperparameter table */}
        <div className="neu-plate p-5 rounded-2xl">
          <div className="text-[10px] font-bold text-neu-dim uppercase tracking-widest mb-3">Hyperparameters</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
            {Object.entries(hp).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 text-xs border-b border-white/5 py-1">
                <span className="font-mono text-neu-dim truncate">{k}</span>
                <span className="font-mono text-neu-text shrink-0">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>

        {(error || missing) && (
          <div className="neu-alert-warn">
            <AlertTriangle size={16} />
            <span>{error || "Missing model or dataset — go back and complete the earlier steps."}</span>
          </div>
        )}

        <div className="flex justify-between items-center pt-6 border-t border-white/5">
          <Button onClick={() => navigate("/finetune/new/hardware")} variant="outline" size="lg">Back</Button>
          <button
            onClick={launch}
            disabled={submitting || missing}
            className={`neu-btn-primary px-8 py-3 flex items-center gap-2 font-bold uppercase tracking-widest text-sm rounded-[24px] ${submitting || missing ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <Play size={16} fill="currentColor" />
            {submitting ? "Initializing…" : "Launch Training Run"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon, title, children }) {
  const Icon = icon;
  return (
    <div className="neu-plate p-5 rounded-2xl">
      <div className="flex items-center gap-2 text-[10px] font-bold text-neu-dim uppercase tracking-widest mb-2">
        <Icon size={13} className="text-neu-accent" /> {title}
      </div>
      {children}
    </div>
  );
}
