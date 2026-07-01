"""File-based store for export jobs.

Separate from ``jobs.json`` so training-run history and export history never mix.
A single lock guards all reads/writes; persistence is atomic via temp + replace.
"""
import json
import threading
from datetime import datetime

from config import EXPORTS_FILE, ensure_dirs

_lock = threading.Lock()


def _load() -> dict:
    if not EXPORTS_FILE.exists():
        return {}
    try:
        with open(EXPORTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: dict) -> None:
    ensure_dirs()
    tmp = EXPORTS_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    tmp.replace(EXPORTS_FILE)


def create_export(export_id: str, data: dict) -> dict:
    with _lock:
        exports = _load()
        exports[export_id] = {
            "export_id": export_id,
            "status": "queued",
            "progress": 0,
            "message": None,
            "output_path": None,
            "error": None,
            "created_at": str(datetime.now()),
            **data,
        }
        _save(exports)
        return exports[export_id]


def update_export(export_id: str, updates: dict) -> None:
    with _lock:
        exports = _load()
        if export_id in exports:
            exports[export_id].update(updates)
            _save(exports)


def get_export(export_id: str):
    with _lock:
        return _load().get(export_id)


def delete_export(export_id: str) -> bool:
    with _lock:
        exports = _load()
        if export_id in exports:
            del exports[export_id]
            _save(exports)
            return True
        return False


def list_exports() -> list:
    with _lock:
        return list(_load().values())


def list_for_run(run_id: str) -> list:
    return [e for e in list_exports() if e.get("run_id") == run_id]
