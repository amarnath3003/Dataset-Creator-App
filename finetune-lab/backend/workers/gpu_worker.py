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


def _build_sft_config(payload: dict[str, Any]):
    """Translate the API job payload into the runner's SFTTrainingConfig."""
    from training.unsloth_sft_runner import SFTTrainingConfig

    hp = payload.get("hyperparameters") or {}

    def num(key, default):
        val = hp.get(key, default)
        return default if val is None else val

    return SFTTrainingConfig(
        run_id=payload["run_id"],
        model_name=payload["model_name"],
        output_dir=payload["output_dir"],
        dataset_source=payload["dataset_path"],
        # model / loading
        max_seq_length=int(num("max_seq_length", 2048)),
        load_in_4bit=bool(num("load_in_4bit", True)),
        hf_token=payload.get("hf_token"),
        # LoRA
        lora_rank=int(num("lora_rank", 16)),
        lora_alpha=int(num("lora_alpha", 16)),
        lora_dropout=float(num("lora_dropout", 0.0)),
        use_rslora=bool(num("use_rslora", False)),
        # training
        num_train_epochs=float(num("epochs", 3)),
        max_steps=int(num("max_steps", -1)),
        per_device_train_batch_size=int(num("batch_size", 2)),
        gradient_accumulation_steps=int(num("gradient_accumulation", 4)),
        learning_rate=float(num("learning_rate", 2e-4)),
        warmup_ratio=float(num("warmup_ratio", 0.03)),
        lr_scheduler_type=str(num("lr_scheduler_type", "cosine")),
        seed=int(num("seed", 3407)),
        packing=bool(num("packing", False)),
        # save
        save_steps=int(num("save_steps", 200)),
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
