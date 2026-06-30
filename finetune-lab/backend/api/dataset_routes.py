"""Dataset API: upload, list, and lightweight inspection.

Inspection is intentionally dependency-free (plain ``json``/``csv``) so it never
pulls in ``datasets``/torch and stays instant for the picker UI. Heavy loading
happens later in the training worker.
"""
import csv
import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from config import DATASETS_DIR, ensure_dirs
from core.dataset_engine.detector import DatasetDetector

router = APIRouter()

SUPPORTED = {".jsonl", ".json", ".csv", ".parquet"}
PREVIEW_ROWS = 3


def _inspect(path: Path) -> dict[str, Any]:
    """Return {rows, columns, format, preview} without heavy deps."""
    suffix = path.suffix.lower()
    columns: list[str] = []
    rows: int | None = None
    preview: list[dict] = []

    if suffix == ".jsonl":
        count = 0
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                count += 1
                if count <= PREVIEW_ROWS:
                    try:
                        obj = json.loads(line)
                        if isinstance(obj, dict):
                            preview.append(obj)
                            for k in obj.keys():
                                if k not in columns:
                                    columns.append(k)
                    except json.JSONDecodeError:
                        pass
        rows = count

    elif suffix == ".json":
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            rows = len(data)
            preview = [r for r in data[:PREVIEW_ROWS] if isinstance(r, dict)]
            if data and isinstance(data[0], dict):
                columns = list(data[0].keys())
        elif isinstance(data, dict):
            rows = 1
            preview = [data]
            columns = list(data.keys())

    elif suffix == ".csv":
        with open(path, "r", encoding="utf-8", newline="") as f:
            reader = csv.reader(f)
            columns = next(reader, []) or []
            rows = sum(1 for _ in reader)

    else:  # .parquet — avoid heavy deps; report unknown row count
        rows = None

    fmt = DatasetDetector.detect(columns).value if columns else "unknown"
    return {"rows": rows, "columns": columns, "format": fmt, "preview": preview}


def _split_id(name: str) -> tuple[str, str]:
    if "_" in name:
        ds_id, original = name.split("_", 1)
        return ds_id, original
    return name, name


@router.get("/")
def list_datasets():
    ensure_dirs()
    items = []
    for p in sorted(DATASETS_DIR.glob("*")):
        if not p.is_file() or p.suffix.lower() not in SUPPORTED:
            continue
        ds_id, name = _split_id(p.name)
        try:
            meta = _inspect(p)
        except Exception:
            meta = {"rows": None, "columns": [], "format": "unknown", "preview": []}
        items.append(
            {
                "id": ds_id,
                "name": name,
                "path": str(p),
                "size_bytes": p.stat().st_size,
                **meta,
            }
        )
    return {"datasets": items}


@router.post("/upload")
async def upload_dataset(file: UploadFile = File(...)):
    ensure_dirs()
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix or '?'}'. Use JSONL, JSON, CSV, or Parquet.",
        )

    ds_id = uuid.uuid4().hex[:12]
    safe_name = Path(file.filename).name
    dest = DATASETS_DIR / f"{ds_id}_{safe_name}"

    content = await file.read()
    dest.write_bytes(content)

    try:
        meta = _inspect(dest)
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail=f"Could not parse dataset: {exc}")

    if not meta["rows"]:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Dataset appears to be empty.")

    return {
        "id": ds_id,
        "name": safe_name,
        "path": str(dest),
        "size_bytes": dest.stat().st_size,
        **meta,
    }


@router.post("/validate")
def validate_dataset(payload: dict):
    path = Path(payload.get("path", ""))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    return {"status": "valid", **_inspect(path)}
