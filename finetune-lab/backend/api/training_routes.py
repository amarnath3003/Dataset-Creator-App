from fastapi import APIRouter
from uuid import uuid4

from job_engine.queue import push_job
from job_engine.job_store import create_job, get_job

router = APIRouter()


@router.post("/create")
def create_training(request: dict):

    job_id = str(uuid4())

    job = {
        "id": job_id,
        **request
    }

    create_job(job_id, job)

    push_job(job)

    return {
        "status": "queued",
        "job_id": job_id
    }

@router.get("/status/{job_id}")
def get_training_status(job_id: str):

    job = get_job(job_id)

    return job
