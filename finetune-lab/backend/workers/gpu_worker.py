"""GPU training worker.

Entry point invoked on a background thread for each run. It maps the API job
payload onto the canonical SFT engine (``UnslothSFTRunner``) and executes it.
All heavy imports (torch / unsloth / trl) are deferred into the function body so
importing this module — and therefore booting the API — never requires the
training stack to be installed.

Supported in Phase 1: ``sft``, ``lora``, ``qlora`` (all adapter-based supervised
training, differing only by quantization). ``full`` / ``cpt`` / ``vision`` are
recognised but cleanly reported as not-yet-implemented.
"""
import logging
import traceback
from typing import Any

logger = logging.getLogger(__name__)

# Methods that route through the supervised LoRA/SFT runner.
_SFT_FAMILY = {"sft", "lora", "qlora"}
_NOT_YET = {"full", "cpt", "vision"}

_BNB_4BIT_SUFFIX = "-bnb-4bit"


def quant_for(training_type: str, hyperparameters: dict[str, Any]) -> bool:
    """Decide 4-bit (QLoRA) vs 16-bit (LoRA) loading.

    - QLoRA / SFT  -> 4-bit base (lowest VRAM).
    - LoRA         -> 16-bit base (higher quality, more VRAM).
    An explicit ``load_in_4bit`` in hyperparameters always wins (full tunability).
    """
    explicit = hyperparameters.get("load_in_4bit")
    if explicit is not None:
        return bool(explicit)
    return (training_type or "sft").lower() != "lora"


def resolve_model_name(model_name: str, load_in_4bit: bool) -> str:
    """16-bit LoRA needs a non-quantized checkpoint.

    Unsloth ships matching 16-bit repos as the same id without the
    ``-bnb-4bit`` suffix, so strip it when loading in 16-bit.
    """
    if not load_in_4bit and model_name.endswith(_BNB_4BIT_SUFFIX):
        return model_name[: -len(_BNB_4BIT_SUFFIX)]
    return model_name


def _build_sft_config(payload: dict[str, Any]):
    """Translate the API job payload into the runner's SFTTrainingConfig.

    Every value is read from the free-form ``hyperparameters`` dict so new
    frontend controls flow through without backend changes.
    """
    from training.unsloth_sft_runner import SFTTrainingConfig

    hp = payload.get("hyperparameters") or {}
    training_type = (payload.get("training_type") or "sft").lower()

    def num(key, default):
        val = hp.get(key, default)
        return default if val is None else val

    load_in_4bit = quant_for(training_type, hp)
    model_name = resolve_model_name(payload["model_name"], load_in_4bit)

    # Optional overrides for advanced users (pass-through when present).
    optional = {}
    if hp.get("target_modules"):
        optional["target_modules"] = list(hp["target_modules"])
    if hp.get("bias") is not None:
        optional["bias"] = str(hp["bias"])
    if hp.get("dtype") is not None:
        optional["dtype"] = str(hp["dtype"])

    return SFTTrainingConfig(
        run_id=payload["run_id"],
        model_name=model_name,
        output_dir=payload["output_dir"],
        dataset_source=payload["dataset_path"],
        # model / loading
        max_seq_length=int(num("max_seq_length", 2048)),
        load_in_4bit=load_in_4bit,
        hf_token=payload.get("hf_token"),
        # LoRA / QLoRA
        lora_rank=int(num("lora_rank", 16)),
        lora_alpha=int(num("lora_alpha", 16)),
        lora_dropout=float(num("lora_dropout", 0.0)),
        use_rslora=bool(num("use_rslora", False)),
        use_loftq=bool(num("use_loftq", False)) and load_in_4bit,
        # training
        num_train_epochs=float(num("epochs", 3)),
        max_steps=int(num("max_steps", -1)),
        per_device_train_batch_size=int(num("batch_size", 2)),
        gradient_accumulation_steps=int(num("gradient_accumulation", 4)),
        learning_rate=float(num("learning_rate", 2e-4)),
        warmup_ratio=float(num("warmup_ratio", 0.03)),
        weight_decay=float(num("weight_decay", 0.0)),
        lr_scheduler_type=str(num("lr_scheduler_type", "cosine")),
        optim=str(num("optim", "paged_adamw_8bit")),
        seed=int(num("seed", 3407)),
        packing=bool(num("packing", False)),
        # save
        save_steps=int(num("save_steps", 200)),
        **optional,
    )


def run_training_job(payload: dict[str, Any]) -> dict[str, Any]:
    from training.job_store_sink import JobStoreSink

    run_id = payload["run_id"]
    training_type = (payload.get("training_type") or "sft").lower()
    sink = JobStoreSink(run_id)

    try:
        if training_type in _NOT_YET:
            raise NotImplementedError(
                f"Training type '{training_type}' is not implemented yet. "
                f"Available now: SFT, LoRA, QLoRA."
            )
        if training_type not in _SFT_FAMILY:
            raise ValueError(f"Unknown training type '{training_type}'.")

        from training.unsloth_sft_runner import UnslothSFTRunner

        cfg = _build_sft_config(payload)
        runner = UnslothSFTRunner(cfg, sink)
        result = runner.run()  # emits job_succeeded / job_failed itself
        return {"run_id": run_id, "status": result.status}

    except Exception as exc:  # noqa: BLE001 — surface everything to the UI
        logger.exception("Training job %s failed before/around execution", run_id)
        sink.emit(
            {
                "type": "job_failed",
                "run_id": run_id,
                "status": "failed",
                "error": str(exc),
                "traceback": traceback.format_exc(),
            }
        )
        return {"run_id": run_id, "status": "failed"}
