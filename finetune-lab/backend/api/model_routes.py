import json
from fastapi import APIRouter, HTTPException

from config import MODELS_FILE

router = APIRouter()


@router.get("/")
def list_models():
    if not MODELS_FILE.exists():
        return []

    with open(MODELS_FILE, "r", encoding="utf-8") as f:
        models = json.load(f)

    return models

@router.get("/{model_id:path}")
def get_model(model_id: str):
    if not MODELS_FILE.exists():
        raise HTTPException(status_code=404, detail="Model registry not found")

    with open(MODELS_FILE, "r", encoding="utf-8") as f:
        models = json.load(f)

    for model in models:
        if model["id"] == model_id:
            return model
            
    raise HTTPException(status_code=404, detail="Model not found")
