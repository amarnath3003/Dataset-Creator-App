"""GPU training worker.

Entry point invoked on a background thread for each run. It maps the API job
payload onto the canonical SFT engine (``UnslothSFTRunner``) and executes it.
All heavy imports (torch / unsloth / trl) are deferred into the function body so
importing this module — and therefore booting the API — never requires the
training stack to be installed.

Supported: ``sft`` / ``lora`` / ``qlora`` (adapter-based, differing by
quantization), ``cpt`` (continued pre-training), ``full`` (full-parameter,
16-bit), and ``vision`` (image+text, routed to ``UnslothVisionRunner``). Any
method can run on multiple GPUs via ``num_gpus`` (DDP through ``accelerate``).
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


def _extract_domain_records(dataset_path: str, limit: int = 200) -> list[dict[str, str]]:
    """Read local JSONL/JSON/CSV dataset records into normalized prompt/response pairs."""
    p = Path(dataset_path)
    records: list[dict[str, str]] = []
    if not p.is_file():
        return records

    def _push(obj: dict[str, Any]) -> None:
        if not isinstance(obj, dict):
            return
        if "messages" in obj and isinstance(obj["messages"], list):
            u = next((m.get("content", "") for m in obj["messages"] if m.get("role") == "user"), "")
            a = next((m.get("content", "") for m in obj["messages"] if m.get("role") == "assistant"), "")
            if u or a:
                records.append({"question": str(u), "answer": str(a)})
            return
        q = obj.get("instruction") or obj.get("question") or obj.get("prompt") or ""
        inp = obj.get("input") or ""
        a = obj.get("output") or obj.get("answer") or obj.get("chosen") or obj.get("response") or obj.get("text") or ""
        if inp and q:
            q = f"{q}\n{inp}"
        if q or a:
            records.append({"question": str(q), "answer": str(a)})

    suffix = p.suffix.lower()
    try:
        if suffix == ".jsonl":
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    if len(records) >= limit:
                        break
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        _push(json.loads(line))
                    except json.JSONDecodeError:
                        continue
        elif suffix == ".json":
            data = json.loads(p.read_text(encoding="utf-8"))
            if isinstance(data, list):
                for item in data[:limit]:
                    _push(item)
            elif isinstance(data, dict):
                _push(data)
        elif suffix == ".csv":
            import csv

            with open(p, "r", encoding="utf-8", newline="") as f:
                for i, row in enumerate(csv.DictReader(f)):
                    if i >= limit:
                        break
                    _push(row)
    except Exception:
        pass
    return records


def _run_simulated_training(payload: dict[str, Any], sink) -> dict[str, Any]:
    """Fast, hardware-independent training simulation that produces a real adapter package."""
    import math
    import time
    from datetime import datetime, timezone
    from job_engine import job_store

    run_id = payload["run_id"]
    training_type = (payload.get("training_type") or "sft").lower()
    hp = payload.get("hyperparameters") or {}
    model_name = payload["model_name"]
    output_dir = Path(payload["output_dir"])
    final_dir = output_dir / "final"
    final_dir.mkdir(parents=True, exist_ok=True)

    load_in_4bit = quant_for(training_type, hp)
    max_seq_len = int(hp.get("max_seq_length", 2048) or 2048)
    lora_rank = int(hp.get("lora_rank", 16) or 16)
    lora_alpha = int(hp.get("lora_alpha", 16) or 16)
    lora_dropout = float(hp.get("lora_dropout", 0.0) or 0.0)
    epochs = float(hp.get("epochs", 1 if training_type == _CPT else 3) or 3)
    lr = float(hp.get("learning_rate", 2e-4) or 2e-4)

    sink.emit({"type": "job_started", "run_id": run_id})
    sink.emit({
        "type": "warning",
        "run_id": run_id,
        "message": "Simulation / Dry-Run Mode active: training telemetry & domain adapter artifacts synthesized without heavyweight weights.",
    })
    sink.emit({
        "type": "model_loading",
        "run_id": run_id,
        "model_name": model_name,
        "load_in_4bit": load_in_4bit,
        "max_seq_length": max_seq_len,
    })
    sink.emit({
        "type": "peft_configured",
        "run_id": run_id,
        "lora_rank": lora_rank,
        "lora_alpha": lora_alpha,
        "lora_dropout": lora_dropout,
        "load_in_4bit": load_in_4bit,
        "use_rslora": bool(hp.get("use_rslora", False)),
    })

    records = _extract_domain_records(payload["dataset_path"], limit=200)
    rows_count = max(1, len(records))
    sink.emit({
        "type": "dataset_loaded",
        "run_id": run_id,
        "rows": rows_count,
        "columns": ["instruction", "input", "output"] if records else ["text"],
    })
    sink.emit({"type": "dataset_formatted", "run_id": run_id, "rows": rows_count, "field": "text"})

    total_steps = 12
    sink.emit({"type": "train_begin", "run_id": run_id, "total_steps": total_steps, "vram_mb": 3420})

    final_loss = 2.18
    cancelled = False
    for step in range(1, total_steps + 1):
        job_now = job_store.get_job(run_id) or {}
        if job_now.get("status") == "cancelling":
            sink.emit({"type": "cancelled", "run_id": run_id})
            cancelled = True
            break

        frac = step / total_steps
        loss = 0.44 + 1.74 * math.exp(-2.6 * frac) + 0.02 * math.sin(step * 1.7)
        final_loss = round(loss, 4)
        cur_lr = round(lr * (0.5 * (1.0 + math.cos(math.pi * frac))), 7)
        sink.emit({
            "type": "metrics",
            "run_id": run_id,
            "global_step": step,
            "max_steps": total_steps,
            "loss": final_loss,
            "learning_rate": cur_lr,
            "epoch": round(epochs * frac, 2),
            "tokens_per_second": round(380.0 + step * 6.5, 1),
            "eta_seconds": max(0, round((total_steps - step) * 0.25)),
            "vram_mb": 3420 + (step % 3) * 48,
        })
        time.sleep(0.18)

    sink.emit({"type": "saving", "run_id": run_id, "path": str(final_dir)})

    adapter_cfg = {
        "peft_type": "LORA",
        "task_type": "CAUSAL_LM",
        "base_model_name_or_path": model_name,
        "r": lora_rank,
        "lora_alpha": lora_alpha,
        "lora_dropout": lora_dropout,
        "simulated": True,
        "training_type": training_type,
    }
    (final_dir / "adapter_config.json").write_text(json.dumps(adapter_cfg, indent=2), encoding="utf-8")
    (final_dir / "adapter_model.bin").write_bytes(b"SIMULATED_LORA_ADAPTER_V1\n")
    (final_dir / "domain_knowledge.json").write_text(
        json.dumps(
            {
                "model_name": model_name,
                "training_type": training_type,
                "dataset_path": payload["dataset_path"],
                "records": records,
            },
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    metrics = {
        "train_loss": final_loss,
        "train_steps": total_steps if not cancelled else step,
        "train_runtime": round(total_steps * 0.18, 2),
        "simulated": True,
    }
    manifest = {
        "run_id": run_id,
        "model_name": model_name,
        "simulated": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "config": {
            "model_name": model_name,
            "dataset_source": payload["dataset_path"],
            "training_type": training_type,
            "load_in_4bit": load_in_4bit,
            "max_seq_length": max_seq_len,
            "lora_rank": lora_rank,
            "epochs": epochs,
        },
        "metrics": metrics,
    }
    (output_dir / "run_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    (output_dir / "training_summary.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    sink.emit({
        "type": "job_succeeded",
        "run_id": run_id,
        "metrics": metrics,
        "final_checkpoint": str(final_dir),
    })
    return {"run_id": run_id, "status": "cancelled" if cancelled else "completed"}


def run_training_job(payload: dict[str, Any]) -> dict[str, Any]:
    from training.job_store_sink import JobStoreSink

    run_id = payload["run_id"]
    training_type = (payload.get("training_type") or "sft").lower()
    num_gpus = int(payload.get("num_gpus") or 1)
    hp = payload.get("hyperparameters") or {}
    simulate = bool(payload.get("simulate") or hp.get("simulate"))
    sink = JobStoreSink(run_id)

    try:
        if training_type in _NOT_YET:
            raise NotImplementedError(f"Training type '{training_type}' is not implemented yet.")
        if training_type not in _KNOWN:
            raise ValueError(f"Unknown training type '{training_type}'.")

        if simulate:
            return _run_simulated_training(payload, sink)

        return _run_subprocess(payload, sink, num_gpus)

    except Exception as exc:  # noqa: BLE001 — surface everything to the UI
        logger.exception("Training job %s failed before execution", run_id)
        sink.emit({
            "type": "job_failed", "run_id": run_id, "status": "failed",
            "error": str(exc), "traceback": traceback.format_exc(),
        })
        return {"run_id": run_id, "status": "failed"}
