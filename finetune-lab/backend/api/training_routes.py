"""Training API.

Mounted at ``/api/training`` by ``main.py`` — this router declares NO inner
prefix (the previous double-prefix bug produced ``/api/training/training/...``).
"""
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
    return job_store.list_jobs()
