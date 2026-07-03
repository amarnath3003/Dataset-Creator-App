import json
import shutil
import urllib.parse
import urllib.request
import uuid
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from config import MODELS_DIR, MODELS_FILE, ensure_dirs

router = APIRouter()

HF_API = "https://huggingface.co/api"


@router.get("/")
def list_models():
    if not MODELS_FILE.exists():
        return []

    with open(MODELS_FILE, "r", encoding="utf-8") as f:
        models = json.load(f)

    return models


@router.get("/search/hf")
def search_hf_models(q: str = "", limit: int = 8):
    """Proxy Hugging Face Hub model search so the picker can show live suggestions while typing."""
    query = q.strip()
    if not query:
        return []

    params = urllib.parse.urlencode({"search": query, "limit": limit, "sort": "downloads", "direction": -1})
    url = f"{HF_API}/models?{params}"
    try:
        with urllib.request.urlopen(url, timeout=6) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Hugging Face search failed: {exc}")

    return [
        {
            "id": m.get("id"),
            "downloads": m.get("downloads"),
            "likes": m.get("likes"),
            "pipeline_tag": m.get("pipeline_tag"),
        }
        for m in data
    ]


@router.post("/upload")
async def upload_local_model(
    files: list[UploadFile] = File(...),
    paths: list[str] = Form(...),
):
    """Accept a browsed local model folder and store it server-side, returning the absolute
    path the training server can load from. Mirrors the dataset upload flow — the browser
    can't hand back a real filesystem path, so we copy the files here and hand the path back."""
    ensure_dirs()
    if len(files) != len(paths):
        raise HTTPException(status_code=400, detail="Mismatched files/paths in upload.")
    if not files:
        raise HTTPException(status_code=400, detail="No files received.")

    upload_id = uuid.uuid4().hex[:12]
    root_name = Path(paths[0]).parts[0] if paths[0] else "model"
    dest_root = MODELS_DIR / upload_id

    for file, rel in zip(files, paths):
        rel_path = Path(rel)
        if rel_path.is_absolute() or ".." in rel_path.parts:
            raise HTTPException(status_code=400, detail=f"Invalid relative path: {rel}")
        dest = dest_root / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        with open(dest, "wb") as out:
            shutil.copyfileobj(file.file, out)

    model_dir = dest_root / root_name
    return {"path": str(model_dir), "files": len(files)}


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
