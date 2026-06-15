import requests
from fastapi import APIRouter

router = APIRouter()

OLLAMA_BASE_URL = "http://localhost:11434"


@router.get("/ollama/models")
def list_ollama_models():
    """Fetch locally available Ollama models."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        response.raise_for_status()
        data = response.json()
        models = [m["name"] for m in data.get("models", [])]
        return {"models": models, "available": True}
    except Exception as e:
        return {"models": [], "available": False, "error": str(e)}
