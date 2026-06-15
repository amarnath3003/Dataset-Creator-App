from fastapi import APIRouter

router = APIRouter()

@router.get("/list")
def list_models():
    return {"models": []}

@router.post("/download")
def download_model():
    return {"status": "Downloading"}
