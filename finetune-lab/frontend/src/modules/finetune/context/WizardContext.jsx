/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect } from "react";

// Holds the in-progress "New Run" draft across the wizard steps. Persisted to
// sessionStorage so a refresh mid-wizard doesn't lose the user's selections.

const STORAGE_KEY = "ftlab.wizard.draft";

const DEFAULT_CONFIG = {
  training_type: "qlora",
  batch_size: 2,
  gradient_accumulation: 4,
  learning_rate: 2e-4,
  epochs: 3,
  max_seq_length: 2048,
  save_steps: 200,
  warmup_ratio: 0.03,
  weight_decay: 0.0,
  lr_scheduler_type: "cosine",
  optim: "paged_adamw_8bit",
  seed: 3407,
  lora_rank: 16,
  lora_alpha: 16,
  lora_dropout: 0.05,
  use_rslora: false,
  use_loftq: false,
  packing: false,
  // CPT
  train_embeddings: true,
  embedding_learning_rate: 0.000005,
  // Vision
  finetune_vision_layers: true,
  finetune_language_layers: true,
  finetune_attention_modules: true,
  finetune_mlp_modules: true,
  vision_instruction: "Describe this image in detail.",
};

const EMPTY_DRAFT = {
  modelId: null,
  modelData: null,
  modelSource: "registry",
  datasetPath: null,
  datasetName: null,
  datasetFormat: null,
  datasetRows: null,
  trainingConfig: DEFAULT_CONFIG,
  numGpus: 1,
  selectedGpuName: null,
};

const WizardContext = createContext(null);

function loadDraft() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_DRAFT, ...JSON.parse(raw) };
  } catch {
    /* ignore corrupt draft */
  }
  return { ...EMPTY_DRAFT };
}

export function WizardProvider({ children }) {
  const [draft, setDraft] = useState(loadDraft);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* storage full / disabled — non-fatal */
    }
  }, [draft]);

  const update = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateConfig = useCallback((patch) => {
    setDraft((prev) => ({ ...prev, trainingConfig: { ...prev.trainingConfig, ...patch } }));
  }, []);

  const reset = useCallback(() => {
    setDraft({ ...EMPTY_DRAFT, trainingConfig: { ...DEFAULT_CONFIG } });
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <WizardContext.Provider value={{ draft, update, updateConfig, reset }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used inside <WizardProvider>");
  return ctx;
}

export { DEFAULT_CONFIG };
