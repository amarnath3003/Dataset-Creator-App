from fastapi import APIRouter

router = APIRouter()

@router.post("/create")
def create_job():
    return {"status": "Job created"}

@router.post("/start")
def start_job():
    return {"status": "Job started"}

@router.post("/stop")
def stop_job():
    return {"status": "Job stopped"}

@router.post("/pause")
def pause_job():
    return {"status": "Job paused"}

@router.post("/resume")
def resume_job():
    return {"status": "Job resumed"}

@router.get("/logs/{job_id}")
def get_logs(job_id: str):
    return {"logs": [], "job_id": job_id}

@router.get("/metrics/{job_id}")
def get_metrics(job_id: str):
    return {"metrics": {}, "job_id": job_id}
