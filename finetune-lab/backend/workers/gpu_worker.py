"""GPU training worker.

Entry point invoked on a background thread for each run. It maps the API job
payload onto the canonical SFT engine (``UnslothSFTRunner``) and executes it.
All heavy imports (torch / unsloth / trl) are deferred into the function body so
importing this module — and therefore booting the API — never requires the
training stack to be installed.

Supported: ``sft`` / ``lora`` / ``qlora`` (adapter-based, differing by
quantization), ``cpt`` (continued pre-training), and ``full`` (full-parameter,
16-bit). Any method can run on multiple GPUs via ``num_gpus`` (DDP through
``accelerate``). ``vision`` is recognised but not yet implemented.
"""
import json
import logging
import os
import sys
import traceback
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Methods that route through the supervised LoRA/SFT/full runner.
_SFT_FAMILY = {"sft", "lora", "qlora"}
_CPT = "cpt"
_FULL = "full"
_VISION = "vision"
_KNOWN = _SFT_FAMILY | {_CPT, _FULL, _VISION}
_NOT_YET: set[str] = set()

# Methods that load a 16-bit base rather than a 4-bit one.
_SIXTEEN_BIT = {"lora", "full"}

_BNB_4BIT_SUFFIX = "-bnb-4bit"


def quant_for(training_type: str, hyperparameters: dict[str, Any]) -> bool:
    """Decide 4-bit vs 16-bit loading.

    - QLoRA / SFT / CPT -> 4-bit base (lowest VRAM).
    - LoRA / Full       -> 16-bit base (LoRA: higher quality; Full: required).
    An explicit ``load_in_4bit`` in hyperparameters always wins (full tunability).
    """
    explicit = hyperparameters.get("load_in_4bit")
    if explicit is not None:
        return bool(explicit)
    return (training_type or "sft").lower() not in _SIXTEEN_BIT


def resolve_model_name(model_name: str, load_in_4bit: bool) -> str:
    """16-bit LoRA needs a non-quantized checkpoint.

    Unsloth ships matching 16-bit repos as the same id without the
    ``-bnb-4bit`` suffix, so strip it when loading in 16-bit.
    """
    if not load_in_4bit and model_name.endswith(_BNB_4BIT_SUFFIX):
        return model_name[: -len(_BNB_4BIT_SUFFIX)]
    return model_name


def _build_config(payload: dict[str, Any]):
    """Translate the API job payload into the runner's SFTTrainingConfig.

    Covers SFT / LoRA / QLoRA and CPT (continued pre-training). Every value is
    read from the free-form ``hyperparameters`` dict so new frontend controls
    flow through without backend changes. CPT supplies raw-text-friendly
    defaults (1 epoch, lower LR, packing on, embeddings trained).
    """
    from training.sft_config import SFTTrainingConfig

    hp = payload.get("hyperparameters") or {}
    training_type = (payload.get("training_type") or "sft").lower()
    is_cpt = training_type == _CPT
    is_full = training_type == _FULL
    is_vision = training_type == _VISION

    def num(key, default):
        val = hp.get(key, default)
        return default if val is None else val

    load_in_4bit = quant_for(training_type, hp)
    if is_full:
        load_in_4bit = False  # full fine-tuning requires a 16-bit base
    model_name = resolve_model_name(payload["model_name"], load_in_4bit)

    # Optional overrides for advanced users (pass-through when present).
    optional = {}
    if hp.get("target_modules"):
        optional["target_modules"] = list(hp["target_modules"])
    if hp.get("bias") is not None:
        optional["bias"] = str(hp["bias"])
    if hp.get("dtype") is not None:
        optional["dtype"] = str(hp["dtype"])

    default_lr = 2e-5 if is_full else (5e-5 if is_cpt else 2e-4)
    learning_rate = float(num("learning_rate", default_lr))

    cfg_kwargs = dict(
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
        num_train_epochs=float(num("epochs", 1 if is_cpt else 3)),
        max_steps=int(num("max_steps", -1)),
        per_device_train_batch_size=int(num("batch_size", 2)),
        gradient_accumulation_steps=int(num("gradient_accumulation", 4)),
        learning_rate=learning_rate,
        warmup_ratio=float(num("warmup_ratio", 0.03)),
        weight_decay=float(num("weight_decay", 0.01 if is_cpt else 0.0)),
        lr_scheduler_type=str(num("lr_scheduler_type", "linear" if is_cpt else "cosine")),
        optim=str(num("optim", "paged_adamw_8bit")),
        seed=int(num("seed", 3407)),
        packing=bool(num("packing", True if is_cpt else False)),
        # save
        save_steps=int(num("save_steps", 200)),
        # full fine-tuning + execution
        full_finetuning=is_full,
        num_gpus=int(payload.get("num_gpus") or 1),
        **optional,
    )

    if is_cpt:
        emb_lr = hp.get("embedding_learning_rate")
        try:
            emb_lr_val = float(emb_lr) if emb_lr not in (None, "") else learning_rate / 10.0
        except (TypeError, ValueError):
            emb_lr_val = learning_rate / 10.0
        cfg_kwargs["train_embeddings"] = bool(num("train_embeddings", True))
        cfg_kwargs["embedding_learning_rate"] = emb_lr_val
        cfg_kwargs["append_eos"] = bool(num("append_eos", True))

    if is_vision:
        cfg_kwargs["finetune_vision_layers"] = bool(num("finetune_vision_layers", True))
        cfg_kwargs["finetune_language_layers"] = bool(num("finetune_language_layers", True))
        cfg_kwargs["finetune_attention_modules"] = bool(num("finetune_attention_modules", True))
        cfg_kwargs["finetune_mlp_modules"] = bool(num("finetune_mlp_modules", True))
        if hp.get("vision_instruction"):
            cfg_kwargs["vision_instruction"] = str(hp["vision_instruction"])

    return SFTTrainingConfig(**cfg_kwargs)


def execute_in_process(payload: dict[str, Any], sink) -> dict[str, Any]:
    """Build the config and run the trainer in THIS process.

    Used directly for single-GPU runs, and by the accelerate entry script on each
    rank for multi-GPU runs. Telemetry is rank-gated inside the sink.
    """
    run_id = payload["run_id"]
    training_type = (payload.get("training_type") or "sft").lower()
    try:
        cfg = _build_config(payload)

        if training_type == _VISION:
            from training.unsloth_vision_runner import UnslothVisionRunner
            runner = UnslothVisionRunner(cfg, sink)
        else:
            from training.unsloth_sft_runner import UnslothSFTRunner
            runner = UnslothSFTRunner(cfg, sink)

        result = runner.run()  # emits job_succeeded / job_failed itself
        return {"run_id": run_id, "status": result.status}
    except Exception as exc:  # noqa: BLE001 — surface everything to the UI
        logger.exception("Training job %s failed during execution", run_id)
        sink.emit({
            "type": "job_failed", "run_id": run_id, "status": "failed",
            "error": str(exc), "traceback": traceback.format_exc(),
        })
        return {"run_id": run_id, "status": "failed"}


def _run_subprocess(payload: dict[str, Any], sink, num_gpus: int) -> dict[str, Any]:
    """Launch the run in an isolated child process (single-GPU or DDP).

    Training always runs out-of-process from the API server, never inline in an
    ASGI worker thread. FastAPI's ``BackgroundTasks`` executes sync callables via
    a thread-pool worker thread (not the main thread) — and empirically, loading
    Unsloth/bitsandbytes/CUDA there crashes the whole interpreter hard on Windows
    (no exception, no log line, the process just dies). A subprocess sidesteps
    that entirely and matches the existing multi-GPU isolation model. The child
    runs ``train_entry.py`` -> ``execute_in_process``; it owns the job record
    (gated to rank 0 under DDP), so the parent just waits and reports terminal
    status if the child died without doing so itself.
    """
    import subprocess

    from config import BASE_DIR
    from job_engine import job_store

    run_id = payload["run_id"]
    output_dir = Path(payload["output_dir"])
    output_dir.mkdir(parents=True, exist_ok=True)
    config_path = output_dir / "job_payload.json"
    config_path.write_text(json.dumps(payload), encoding="utf-8")

    sink.emit({"type": "job_started", "run_id": run_id})

    entry = str(BASE_DIR / "training" / "train_entry.py")
    if num_gpus > 1:
        sink.emit({"type": "warning", "run_id": run_id,
                   "message": f"Launching multi-GPU training on {num_gpus} GPUs via accelerate..."})
        cmd = [
            sys.executable, "-m", "accelerate.commands.launch",
            "--num_processes", str(num_gpus), "--num_machines", "1",
            "--mixed_precision", "bf16",
            entry, "--config", str(config_path),
        ]
    else:
        cmd = [sys.executable, entry, "--config", str(config_path)]

    env = dict(os.environ)
    env["PYTHONPATH"] = str(BASE_DIR) + os.pathsep + env.get("PYTHONPATH", "")

    try:
        proc = subprocess.run(cmd, cwd=str(BASE_DIR), env=env,
                              capture_output=True, text=True)
    except FileNotFoundError as exc:
        sink.emit({"type": "job_failed", "run_id": run_id,
                   "error": f"Could not launch training subprocess: {exc}"})
        return {"run_id": run_id, "status": "failed"}

    # The child normally emits the terminal status itself. Only step in if it
    # died without doing so (e.g. a hard crash with no Python exception).
    job = job_store.get_job(run_id) or {}
    if job.get("status") not in ("completed", "failed", "cancelled"):
        if proc.returncode == 0:
            sink.emit({"type": "job_succeeded", "run_id": run_id, "metrics": {},
                       "final_checkpoint": str(output_dir / "final")})
        else:
            tail = (proc.stderr or proc.stdout or "")[-1500:]
            sink.emit({"type": "job_failed", "run_id": run_id,
                       "error": f"Training subprocess exited with code {proc.returncode}. {tail}"})

    final = job_store.get_job(run_id) or {}
    return {"run_id": run_id, "status": final.get("status", "failed")}


def run_training_job(payload: dict[str, Any]) -> dict[str, Any]:
    from training.job_store_sink import JobStoreSink

    run_id = payload["run_id"]
    training_type = (payload.get("training_type") or "sft").lower()
    num_gpus = int(payload.get("num_gpus") or 1)
    sink = JobStoreSink(run_id)

    try:
        if training_type in _NOT_YET:
            raise NotImplementedError(f"Training type '{training_type}' is not implemented yet.")
        if training_type not in _KNOWN:
            raise ValueError(f"Unknown training type '{training_type}'.")

        return _run_subprocess(payload, sink, num_gpus)

    except Exception as exc:  # noqa: BLE001 — surface everything to the UI
        logger.exception("Training job %s failed before execution", run_id)
        sink.emit({
            "type": "job_failed", "run_id": run_id, "status": "failed",
            "error": str(exc), "traceback": traceback.format_exc(),
        })
        return {"run_id": run_id, "status": "failed"}
