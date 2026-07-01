"""Export orchestration: turn a finished run's adapter into a shippable artifact.

Kept free of heavy ML imports so it can be imported at API boot. The worker
(which pulls in torch/unsloth) is imported lazily inside ``dispatch``.

Export kinds:
  - ``adapter``      : the LoRA adapter already on disk (instant, no GPU).
  - ``merged_16bit`` : base + adapter merged into a 16-bit checkpoint.
  - ``gguf``         : merged then converted to GGUF (llama.cpp), quantized.
  - ``hub``          : merged model pushed to the Hugging Face Hub.
"""
import uuid
from pathlib import Path
from typing import Any

from config import EXPORTS_DIR
from job_engine import export_store, job_store

VALID_KINDS = {"adapter", "merged_16bit", "gguf", "hub"}


def create_export(run_id: str, kind: str, options: dict[str, Any] | None = None) -> dict[str, Any]:
    """Validate the request against the run, create a record, return the payload.

    Raises ``ValueError`` with a human message on any precondition failure.
    """
    options = options or {}
    kind = (kind or "").lower()
    if kind not in VALID_KINDS:
        raise ValueError(f"Unknown export kind '{kind}'. Use one of {sorted(VALID_KINDS)}.")

    job = job_store.get_job(run_id)
    if not job:
        raise ValueError("Run not found.")
    if job.get("status") not in ("completed", "cancelled"):
        raise ValueError("The run must finish before it can be exported.")

    config = job.get("config") or {}
    output_dir = config.get("output_dir") or ""
    final_dir = job.get("final_dir") or str(Path(output_dir) / "final")
    if not final_dir or not Path(final_dir).exists():
        raise ValueError("No saved adapter found for this run.")

    if kind == "hub" and not (options.get("repo_id") or "").strip():
        raise ValueError("A Hugging Face repo id is required to push to the Hub.")

    export_id = uuid.uuid4().hex[:12]
    out_root = str(EXPORTS_DIR / export_id)

    payload = {
        "export_id": export_id,
        "run_id": run_id,
        "kind": kind,
        "base_model": config.get("model_name"),
        "training_type": job.get("training_type"),
        "adapter_dir": final_dir,
        "output_root": out_root,
        "options": options,
    }

    export_store.create_export(
        export_id,
        {
            "run_id": run_id,
            "kind": kind,
            "base_model": config.get("model_name"),
            "adapter_dir": final_dir,
            "output_root": out_root,
            "options": {k: v for k, v in options.items() if k != "hf_token"},
        },
    )

    return {"export_id": export_id, "payload": payload}


def dispatch(payload: dict[str, Any]) -> None:
    """Run the export. Imported lazily so API boot never needs the ML stack."""
    from workers.export_worker import run_export_job

    run_export_job(payload)
