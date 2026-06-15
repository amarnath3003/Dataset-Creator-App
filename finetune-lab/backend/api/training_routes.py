import uuid
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel
from typing import Any, Dict

from workers.gpu_worker import run_training_job
from job_engine.job_store import _load, _save

router = APIRouter(prefix="/training", tags=["training"])

class TrainingCreateRequest(BaseModel):
    model: str
    dataset_path: str
    training_type: str
    config: Dict[str, Any]

@router.post("/create")
def start_training(req: TrainingCreateRequest, background_tasks: BackgroundTasks):
    job_id = str(uuid.uuid4())
    
    # Map frontend payload to TrainingConfig payload
    job_payload = {
        "run_id": job_id,
        "training_type": req.training_type,
        "model_name": req.model,
        "dataset_path": req.dataset_path,
        "output_dir": f"storage/runs/{job_id}",
        "batch_size": req.config.get("batch_size", 2),
        "learning_rate": req.config.get("learning_rate", 2e-4),
        "epochs": req.config.get("epochs", 3),
        
        # Defaults for other config values
        "max_seq_length": 2048,
        "load_in_4bit": True,
        "lora_rank": 16,
        "lora_alpha": 16,
        "lora_dropout": 0.0,
        "gradient_accumulation": 4,
        "multi_gpu": False,
        "num_gpus": 1,
        "export_gguf": False,
        "quantize": False,
        "push_to_hub": False
    }
    
    # Initialize in job store
    data = _load()
    data[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "loss": None,
        "config": job_payload
    }
    _save(data)

    # Dispatch to background task using the real unsloth runner
    background_tasks.add_task(run_training_job, job_payload)

    return {
        "ok": True,
        "job_id": job_id,
        "status": "queued",
    }

@router.get("/status/{job_id}")
def get_training_status(job_id: str):
    data = _load()
    if job_id not in data:
        return {"error": "Job not found"}
    return data[job_id]
