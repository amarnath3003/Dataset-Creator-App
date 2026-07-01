"""Run orchestration: create a run record and dispatch it to the GPU worker.

Kept free of heavy ML imports so it can be imported at API boot. The actual
worker (which pulls in torch/unsloth) is imported lazily inside ``dispatch``.
"""
import shutil
import uuid
from typing import Any

from config import RUNS_DIR
from job_engine import job_store


def create_run(req) -> dict[str, Any]:
    """Create the persistent run record and return the worker payload."""
    run_id = str(uuid.uuid4())
    output_dir = str(RUNS_DIR / run_id)

    payload = {
        "run_id": run_id,
        "training_type": req.training_type,
        "model_name": req.model_name,
        "dataset_path": req.dataset_path,
        "output_dir": output_dir,
        "num_gpus": getattr(req, "num_gpus", 1) or 1,
        "hyperparameters": req.hyperparameters or {},
    }

    job_store.create_job(
        run_id,
        {
            "model_name": req.model_name,
            "dataset_path": req.dataset_path,
            "training_type": req.training_type,
            "config": payload,
            "logs": [],
            "total_steps": None,
            "step": 0,
            "epoch": 0,
            "loss": None,
            "learning_rate": None,
            "vram_mb": 0,
            "eta_seconds": None,
            "final_dir": None,
            "metrics": None,
            "error": None,
        },
    )

    return {"run_id": run_id, "payload": payload}


def delete_run_artifacts(run_id: str) -> None:
    """Remove a run's on-disk output tree (adapters, checkpoints, manifest)."""
    run_dir = RUNS_DIR / run_id
    if run_dir.exists():
        shutil.rmtree(run_dir, ignore_errors=True)


def dispatch(payload: dict[str, Any]) -> None:
    """Run the job. Imported lazily so API boot never needs the training stack."""
    from workers.gpu_worker import run_training_job

    run_training_job(payload)
