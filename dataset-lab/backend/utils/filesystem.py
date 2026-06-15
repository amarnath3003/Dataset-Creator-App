from pathlib import Path
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
from backend.config import settings


def get_project_path(project_name: str) -> Path:
    return settings.PROJECTS_DIR / project_name


def create_project(project_name: str) -> Path:
    path = get_project_path(project_name)
    if path.exists():
        raise FileExistsError(f"Project '{project_name}' already exists")
    path.mkdir(parents=True, exist_ok=True)
    return path


def list_projects() -> List[str]:
    if not settings.PROJECTS_DIR.exists():
        return []
    return [p.name for p in settings.PROJECTS_DIR.iterdir() if p.is_dir()]


def get_project_status(project_name: str) -> Optional[Dict[str, Any]]:
    path = get_project_path(project_name)
    if not path.exists():
        return None

    raw_path = path / "raw.txt"
    cleaned_path = path / "cleaned.txt"
    chunks_path = path / "chunks.json"
    qa_path = path / "qa_v1.json"

    chunk_count = 0
    if chunks_path.exists():
        try:
            with open(chunks_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                chunk_count = len(data)
        except Exception:
            pass

    qa_count = 0
    if qa_path.exists():
        try:
            with open(qa_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                qa_count = len(data)
        except Exception:
            pass

    return {
        "project_name": project_name,
        "has_raw": raw_path.exists(),
        "has_cleaned": cleaned_path.exists(),
        "has_chunks": chunks_path.exists(),
        "has_qa": qa_path.exists(),
        "chunk_count": chunk_count,
        "qa_count": qa_count,
        "created_at": datetime.fromtimestamp(path.stat().st_ctime).isoformat(),
    }


def save_raw_text(project_name: str, content: str):
    path = get_project_path(project_name)
    # Ensure project exists even if not strictly "created" via API first
    path.mkdir(parents=True, exist_ok=True)
    with open(path / "raw.txt", "w", encoding="utf-8") as f:
        f.write(content)
