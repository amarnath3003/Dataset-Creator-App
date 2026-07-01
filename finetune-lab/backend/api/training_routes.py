"""Training API.

Mounted at ``/api/training`` by ``main.py`` — this router declares NO inner
prefix (the previous double-prefix bug produced ``/api/training/training/...``).
"""
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from services import run_service
from job_engine import job_store

router = APIRouter()


class TrainingRequest(BaseModel):
    model_name: str
    dataset_path: str
    training_type: str = "sft"
    num_gpus: int = 1
    hyperparameters: Dict[str, Any] = Field(default_factory=dict)


@router.post("/create")
def start_training(req: TrainingRequest, background_tasks: BackgroundTasks):
    if not req.dataset_path:
        raise HTTPException(status_code=400, detail="A dataset is required.")
    if not req.model_name:
        raise HTTPException(status_code=400, detail="A base model is required.")

    run = run_service.create_run(req)
    background_tasks.add_task(run_service.dispatch, run["payload"])

    return {"ok": True, "job_id": run["run_id"], "status": "queued"}


@router.get("/status/{job_id}")
def get_training_status(job_id: str):
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/runs")
def list_runs():
    """Newest-first list of every run for the history page."""
    jobs = job_store.list_jobs()
    jobs.sort(key=lambda j: str(j.get("created_at", "")), reverse=True)
    return jobs


@router.get("/runs/{job_id}")
def get_run(job_id: str):
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Run not found")
    return job


@router.post("/stop/{job_id}")
def stop_run(job_id: str):
    """Request cooperative cancellation.

    The training callback (``on_step_end``) polls the job status and halts the
    HF/TRL loop at the next step boundary when it sees ``cancelling``. Queued
    runs that have not started yet flip straight to ``cancelled``.
    """
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Run not found")

    status = job.get("status")
    if status in ("completed", "failed", "cancelled"):
        return {"ok": True, "status": status, "note": "Run already finished."}

    if status == "queued":
        job_store.update_job(job_id, {"status": "cancelled"})
        return {"ok": True, "status": "cancelled"}

    job_store.update_job(job_id, {"status": "cancelling"})
    return {"ok": True, "status": "cancelling"}


@router.delete("/runs/{job_id}")
def delete_run(job_id: str):
    """Delete the run record and its on-disk artifacts."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Run not found")
    if job.get("status") in ("running", "cancelling"):
        raise HTTPException(
            status_code=409,
            detail="Stop the run before deleting it.",
        )

    run_service.delete_run_artifacts(job_id)
    job_store.delete_job(job_id)
    return {"ok": True, "deleted": job_id}


@router.get("/runs/{job_id}/checkpoints")
def list_checkpoints(job_id: str):
    """Enumerate saved checkpoints + the final adapter for a run."""
    job = job_store.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Run not found")

    output_dir = ((job.get("config") or {}).get("output_dir")) or ""
    root = Path(output_dir)
    checkpoints: list[dict[str, Any]] = []
    if root.exists():
        for p in sorted(root.glob("checkpoint-*")):
            if not p.is_dir():
                continue
            step = None
            try:
                step = int(p.name.split("-", 1)[1])
            except (ValueError, IndexError):
                pass
            checkpoints.append({"name": p.name, "step": step, "path": str(p)})
        checkpoints.sort(key=lambda c: (c["step"] is None, c["step"] or 0))

    final = root / "final"
    return {
        "run_id": job_id,
        "checkpoints": checkpoints,
        "final_dir": str(final) if final.exists() else job.get("final_dir"),
        "has_final": final.exists() or bool(job.get("final_dir")),
    }
