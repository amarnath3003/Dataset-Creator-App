from fastapi import APIRouter
from pydantic import BaseModel

from job_engine.queue import push_job

router = APIRouter()


class TrainingRequest(BaseModel):

    model: str
    dataset_path: str
    training_type: str
    config: dict


@router.post("/create")
def create_training(request: TrainingRequest):

    job = {
        "id": "job_001",
        "model": request.model,
        "dataset_path": request.dataset_path,
        "training_type": request.training_type,
        "config": request.config
    }

    push_job(job)

    return {
        "status": "queued",
        "job_id": "job_001"
    }
