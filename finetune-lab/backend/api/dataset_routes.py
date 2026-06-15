from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def list_datasets():
    return {"datasets": []}

@router.post("/validate")
def validate_dataset():
    return {"status": "Valid"}
