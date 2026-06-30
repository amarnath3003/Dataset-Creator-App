"""Training config dataclasses — intentionally free of heavy ML imports.

Kept separate from ``unsloth_sft_runner`` (which imports torch/unsloth/trl) so the
worker's config-mapping logic can be imported and unit-tested without a GPU stack.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal, Optional


@dataclass
class SFTTrainingConfig:
    run_id: str
    model_name: str
    output_dir: str

    # dataset can be:
    # - local path to json/jsonl/parquet/csv
    # - HF dataset name
    # - already-loaded datasets.Dataset
    dataset_source: Any

    # model / loading
    max_seq_length: int = 2048
    load_in_4bit: bool = True
    dtype: Optional[str] = None
    hf_token: Optional[str] = None
    trust_remote_code: bool = True

    # LoRA
    lora_rank: int = 16
    lora_alpha: int = 16
    lora_dropout: float = 0.0
    bias: str = "none"
    target_modules: list[str] = field(
        default_factory=lambda: [
            "q_proj",
            "k_proj",
            "v_proj",
            "o_proj",
            "gate_proj",
            "up_proj",
            "down_proj",
        ]
    )
    use_rslora: bool = False
    use_loftq: bool = False
    use_gradient_checkpointing: bool = True

    # training
    num_train_epochs: float = 3.0
    max_steps: int = -1
    per_device_train_batch_size: int = 2
    gradient_accumulation_steps: int = 4
    learning_rate: float = 2e-4
    warmup_ratio: float = 0.03
    weight_decay: float = 0.0
    lr_scheduler_type: str = "cosine"
    optim: str = "paged_adamw_8bit"
    seed: int = 3407
    bf16: bool = True
    fp16: bool = False
    packing: bool = False

    # CPT (continued pre-training) — raw-text training of the base + embeddings
    train_embeddings: bool = False          # also tune embed_tokens + lm_head
    embedding_learning_rate: Optional[float] = None  # separate (lower) LR for embeddings
    append_eos: bool = False                # append EOS to each raw-text document

    # Full fine-tuning — train all parameters (no LoRA adapters); needs 16-bit base
    full_finetuning: bool = False

    # Vision (VLM) — which parts of a multimodal model to fine-tune
    finetune_vision_layers: bool = True
    finetune_language_layers: bool = True
    finetune_attention_modules: bool = True
    finetune_mlp_modules: bool = True
    vision_instruction: str = "Describe this image in detail."

    # Execution — number of GPUs (>1 launches DDP via accelerate)
    num_gpus: int = 1

    # logging / eval / save
    logging_steps: int = 1
    save_strategy: str = "steps"
    save_steps: int = 200
    save_total_limit: int = 2
    evaluation_strategy: str = "no"
    eval_steps: Optional[int] = None
    report_to: list[str] = field(default_factory=list)

    # resume / retries
    resume_from_checkpoint: Optional[str] = None
    retry_on_oom: bool = True
    max_oom_retries: int = 2

    # dataset formatting
    dataset_text_field: str = "text"

    # hub
    push_to_hub: bool = False
    hub_model_id: Optional[str] = None
    hub_private_repo: bool = False

    # optional preformatted text / chat rendering behavior
    chat_template: Optional[str] = None


@dataclass
class TrainingRunResult:
    run_id: str
    status: Literal["succeeded", "failed", "oom_failed"]
    output_dir: str
    metrics: dict[str, Any] = field(default_factory=dict)
    error: Optional[str] = None
    traceback: Optional[str] = None
    final_checkpoint: Optional[str] = None
