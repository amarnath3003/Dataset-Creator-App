"""Discover chat-able models.

A "chat-able model" is either:
  1. A finished Finetune Lab run — a saved PEFT adapter (+ tokenizer) under
     ``finetune-lab/backend/storage/runs/{run_id}/final``, recorded as
     ``completed`` in ``jobs.json`` and/or described by a ``run_manifest.json``.
  2. A base foundation model from the Finetune Lab registry (so the user can
     chat with the un-tuned model, and so Compare can put base vs fine-tuned
     side by side).

This module is intentionally free of any ML imports — it only reads JSON and
inspects the filesystem, so the API can serve the model list without torch.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

from config import (
    FINETUNE_JOBS_FILE,
    FINETUNE_MODELS_FILE,
    FINETUNE_RUNS_DIR,
)

# Files Unsloth/PEFT writes that confirm a usable adapter directory.
_ADAPTER_MARKERS = ("adapter_config.json", "adapter_model.safetensors", "adapter_model.bin")


# ---------------------------------------------------------------------------
# Low-level JSON readers
# ---------------------------------------------------------------------------
def _read_json(path: Path, default: Any) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return default


def _load_jobs() -> dict[str, Any]:
    data = _read_json(FINETUNE_JOBS_FILE, {})
    return data if isinstance(data, dict) else {}


def _load_manifest(run_dir: Path) -> dict[str, Any]:
    return _read_json(run_dir / "run_manifest.json", {})


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _adapter_dir_for(run_dir: Path) -> Optional[Path]:
    """Return the directory that actually holds the trained adapter, if any.

    Finetune Lab saves the final artifacts under ``<run>/final``. Be lenient and
    also accept the run dir itself in case a future export writes there.
    """
    candidates = [run_dir / "final", run_dir]
    for cand in candidates:
        if cand.is_dir() and any((cand / m).exists() for m in _ADAPTER_MARKERS):
            return cand
    return None


def _normalize_run(run_id: str, run_dir: Path, job: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Build a uniform record describing one chat-able fine-tuned run."""
    adapter_dir = _adapter_dir_for(run_dir)
    if adapter_dir is None:
        return None  # not actually trained / no weights on disk yet

    manifest = _load_manifest(run_dir)
    cfg = manifest.get("config") or {}

    # Base model + quantization: prefer the manifest (ground truth from training),
    # fall back to the job record, then to sane defaults.
    base_model = (
        manifest.get("model_name")
        or cfg.get("model_name")
        or job.get("model_name")
        or "unknown"
    )
    training_type = job.get("training_type") or "sft"
    load_in_4bit = cfg.get("load_in_4bit")
    if load_in_4bit is None:
        # QLoRA/SFT default to 4-bit, LoRA to 16-bit (mirrors gpu_worker.quant_for).
        load_in_4bit = str(training_type).lower() != "lora"

    metrics = manifest.get("metrics") or job.get("metrics") or {}

    return {
        "run_id": run_id,
        "kind": "finetuned",
        "label": _label_for(run_id, base_model, training_type, job),
        "base_model": base_model,
        "adapter_dir": str(adapter_dir),
        "training_type": training_type,
        "load_in_4bit": bool(load_in_4bit),
        "max_seq_length": int(cfg.get("max_seq_length", 2048) or 2048),
        "lora_rank": cfg.get("lora_rank"),
        "dataset_path": job.get("dataset_path") or cfg.get("dataset_source"),
        "created_at": job.get("created_at"),
        "final_loss": _final_loss(metrics),
        "metrics": metrics,
    }


def _label_for(run_id: str, base_model: str, training_type: str, job: dict) -> str:
    short = base_model.split("/")[-1] if base_model else "model"
    return f"{short} · {str(training_type).upper()} · {run_id[:8]}"


def _final_loss(metrics: dict[str, Any]) -> Optional[float]:
    for key in ("train_loss", "loss", "eval_loss"):
        if key in metrics and isinstance(metrics[key], (int, float)):
            return round(float(metrics[key]), 4)
    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def list_finetuned() -> list[dict[str, Any]]:
    """Every fine-tuned run that has loadable weights on disk.

    We union two sources so nothing is missed:
      - ``jobs.json`` entries marked completed (authoritative metadata), and
      - any run directory on disk with adapter weights (covers runs whose job
        record was lost, e.g. ``jobs.json`` reset).
    """
    jobs = _load_jobs()
    seen: set[str] = set()
    out: list[dict[str, Any]] = []

    # 1) Completed jobs first (richest metadata).
    for run_id, job in jobs.items():
        if str(job.get("status")) != "completed":
            continue
        run_dir = FINETUNE_RUNS_DIR / run_id
        record = _normalize_run(run_id, run_dir, job)
        if record:
            out.append(record)
            seen.add(run_id)

    # 2) Orphan directories on disk not represented above.
    if FINETUNE_RUNS_DIR.is_dir():
        for run_dir in FINETUNE_RUNS_DIR.iterdir():
            if not run_dir.is_dir() or run_dir.name in seen:
                continue
            record = _normalize_run(run_dir.name, run_dir, jobs.get(run_dir.name, {}))
            if record:
                out.append(record)
                seen.add(run_dir.name)

    # Newest first (created_at is an ISO-ish string; lexical sort is fine, None last).
    out.sort(key=lambda r: (r.get("created_at") or ""), reverse=True)
    return out


def list_base_models() -> list[dict[str, Any]]:
    """Base foundation models from the Finetune Lab registry."""
    models = _read_json(FINETUNE_MODELS_FILE, [])
    if not isinstance(models, list):
        return []
    out = []
    for m in models:
        out.append(
            {
                "run_id": None,
                "kind": "base",
                "label": f"{m.get('name', m.get('id'))} · BASE",
                "base_model": m.get("id"),
                "adapter_dir": None,
                "training_type": None,
                "load_in_4bit": "4bit" in (m.get("quantization") or []),
                "max_seq_length": m.get("context_length", 2048),
                "min_vram": m.get("min_vram"),
                "family": m.get("family"),
                "parameters": m.get("parameters"),
            }
        )
    return out


def get_target(run_id: Optional[str], base_model: Optional[str]) -> dict[str, Any]:
    """Resolve a chat target spec from either a run_id or a raw base_model id.

    Returns a dict the ModelManager understands. Raises ValueError if neither
    resolves to something loadable.
    """
    if run_id:
        for r in list_finetuned():
            if r["run_id"] == run_id:
                return r
        raise ValueError(f"No fine-tuned run found with id '{run_id}'.")

    if base_model:
        # Allow chatting with any base model id directly (registry or arbitrary).
        for b in list_base_models():
            if b["base_model"] == base_model:
                return b
        # Not in the registry — still allow it (user typed a HF id).
        return {
            "run_id": None,
            "kind": "base",
            "label": f"{base_model.split('/')[-1]} · BASE",
            "base_model": base_model,
            "adapter_dir": None,
            "training_type": None,
            "load_in_4bit": base_model.endswith("-bnb-4bit"),
            "max_seq_length": 2048,
        }

    raise ValueError("Provide either run_id or base_model.")
