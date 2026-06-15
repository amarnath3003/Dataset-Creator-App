import json
import os
from fastapi import APIRouter, HTTPException

router = APIRouter()

MODELS_FILE = "model_registry/models.json"

@router.get("/")
def list_models():
    if not os.path.exists(MODELS_FILE):
        return []
        
    with open(MODELS_FILE, "r") as f:
        models = json.load(f)
        
    return models

@router.get("/{model_id:path}")
def get_model(model_id: str):
    if not os.path.exists(MODELS_FILE):
        raise HTTPException(status_code=404, detail="Model registry not found")
        
    with open(MODELS_FILE, "r") as f:
        models = json.load(f)
        
    for model in models:
        if model["id"] == model_id:
            return model
            
    raise HTTPException(status_code=404, detail="Model not found")
