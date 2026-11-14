"""Dataset API: upload, list, and lightweight inspection.

Inspection is intentionally dependency-free (plain ``json``/``csv``) so it never
pulls in ``datasets``/torch and stays instant for the picker UI. Heavy loading
happens later in the training worker.
"""
import csv
import json
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from config import DATASET_LAB_PROJECTS, DATASETS_DIR, ensure_dirs
from core.dataset_engine.detector import DatasetDetector

router = APIRouter()

HF_API = "https://huggingface.co/api"

SUPPORTED = {".jsonl", ".json", ".csv", ".parquet"}
PREVIEW_ROWS = 5


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
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict):
                    continue
                count += 1
                if count <= PREVIEW_ROWS:
                    preview.append(obj)
                    for k in obj.keys():
                        if k not in columns:
                            columns.append(k)
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
            reader = csv.DictReader(f)
            columns = list(reader.fieldnames or [])
            count = 0
            for row in reader:
                count += 1
                if count <= PREVIEW_ROWS:
                    preview.append(dict(row))
            rows = count

    else:  # .parquet — avoid heavy deps; report unknown row count
        rows = None

    fmt = DatasetDetector.detect(columns).value if columns else "unknown"
    return {"rows": rows, "columns": columns, "format": fmt, "preview": preview}


def _split_id(name: str) -> tuple[str, str]:
    if "_" in name:
        ds_id, original = name.split("_", 1)
        return ds_id, original
    return name, name


def _safe_slug(text: str) -> str:
    import re

    slug = re.sub(r"[^A-Za-z0-9.-]+", "-", text).strip("-.")
    return slug or "project"


def _sync_dataset_lab_projects() -> None:
    """Auto-discover Dataset Lab projects and mirror their QA/export datasets."""
    if not DATASET_LAB_PROJECTS.is_dir():
        return

    for proj_dir in sorted(DATASET_LAB_PROJECTS.iterdir()):
        if not proj_dir.is_dir():
            continue
        proj_slug = _safe_slug(proj_dir.name)

        # 1) Sync raw generated/edited qa_v1.json -> Instruction JSONL
        qa_path = proj_dir / "qa_v1.json"
        if qa_path.is_file():
            target = DATASETS_DIR / f"dslab-{proj_slug}-qa_{proj_dir.name}_qa.jsonl"
            if not target.exists() or qa_path.stat().st_mtime > target.stat().st_mtime:
                try:
                    raw = json.loads(qa_path.read_text(encoding="utf-8"))
                    if isinstance(raw, list) and raw:
                        lines = []
                        for item in raw:
                            if not isinstance(item, dict):
                                continue
                            instr = str(item.get("question") or item.get("instruction") or "").strip()
                            out = str(item.get("answer") or item.get("output") or "").strip()
                            inp = str(item.get("input") or "").strip()
                            if instr and out:
                                lines.append(
                                    json.dumps(
                                        {"instruction": instr, "input": inp, "output": out},
                                        ensure_ascii=False,
                                    )
                                )
                        if lines:
                            target.write_text("\n".join(lines) + "\n", encoding="utf-8")
                except Exception:
                    pass

        # 2) Sync exported JSONL files inside projects/<name>/exports/
        exports_dir = proj_dir / "exports"
        if exports_dir.is_dir():
            for exp_file in sorted(exports_dir.glob("*.jsonl")):
                if not exp_file.is_file() or exp_file.stat().st_size == 0:
                    continue
                exp_slug = _safe_slug(exp_file.stem)
                target = DATASETS_DIR / f"dslab-{proj_slug}-{exp_slug}_{proj_dir.name}_{exp_file.name}"
                if not target.exists() or exp_file.stat().st_mtime > target.stat().st_mtime:
                    try:
                        target.write_bytes(exp_file.read_bytes())
                    except Exception:
                        pass


@router.get("/")
def list_datasets():
    ensure_dirs()
    _sync_dataset_lab_projects()
    items = []
    for p in sorted(DATASETS_DIR.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True):
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
                "source": "dataset-lab" if ds_id.startswith("dslab-") else "local",
                **meta,
            }
        )
    return {"datasets": items}


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str):
    ensure_dirs()
    clean_id = Path(dataset_id).name
    if not clean_id or clean_id != dataset_id:
        raise HTTPException(status_code=400, detail="Invalid dataset id.")
    matches = [
        p
        for p in DATASETS_DIR.iterdir()
        if p.is_file() and (p.name.startswith(f"{clean_id}_") or p.name == clean_id)
    ]
    if not matches:
        raise HTTPException(status_code=404, detail="Dataset not found.")
    for p in matches:
        p.unlink(missing_ok=True)
    return {"ok": True, "deleted": clean_id, "files": [m.name for m in matches]}


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

    if meta["rows"] == 0:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Dataset appears to be empty.")

    return {
        "id": ds_id,
        "name": safe_name,
        "path": str(dest),
        "size_bytes": dest.stat().st_size,
        **meta,
    }


@router.get("/search/hf")
def search_hf_datasets(q: str = "", limit: int = 8):
    """Proxy Hugging Face Hub dataset search so the picker can show live suggestions while typing."""
    query = q.strip()
    if not query:
        return []

    params = urllib.parse.urlencode({"search": query, "limit": limit, "sort": "downloads", "direction": -1})
    url = f"{HF_API}/datasets?{params}"
    try:
        with urllib.request.urlopen(url, timeout=6) as resp:
            data = json.loads(resp.read())
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Hugging Face search failed: {exc}")

    return [
        {
            "id": d.get("id"),
            "downloads": d.get("downloads"),
            "likes": d.get("likes"),
        }
        for d in data
    ]


@router.post("/validate")
def validate_dataset(payload: dict):
    raw = payload.get("path", "")
    if not raw:
        raise HTTPException(status_code=400, detail="A dataset path is required.")

    ensure_dirs()
    path = Path(raw).resolve()
    datasets_root = DATASETS_DIR.resolve()
    if path != datasets_root and datasets_root not in path.parents:
        # CORS is wide open (`*`) on this API, so any page the user's browser
        # visits could otherwise POST an arbitrary absolute path here and read
        # it back — restrict to the managed datasets directory.
        raise HTTPException(status_code=403, detail="Path must be inside the datasets directory.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Dataset not found.")
    if path.suffix.lower() not in SUPPORTED:
        raise HTTPException(status_code=400, detail=f"Unsupported file type '{path.suffix}'.")

    return {"status": "valid", **_inspect(path)}
