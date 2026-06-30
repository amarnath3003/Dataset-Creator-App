"""File-based job store for training runs.

A single process-wide lock guards all reads/writes so the training worker
(streaming metric events on a background thread) and the API (status polling)
never corrupt ``jobs.json``. Persistence is best-effort and atomic via a temp
file + replace.
"""
import json
import threading
from datetime import datetime

from config import JOBS_FILE, ensure_dirs

_lock = threading.Lock()


def _load() -> dict:
    if not JOBS_FILE.exists():
        return {}
    try:
        with open(JOBS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: dict) -> None:
    ensure_dirs()
    tmp = JOBS_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
    tmp.replace(JOBS_FILE)


def create_job(job_id: str, job_data: dict) -> dict:
    with _lock:
        jobs = _load()
        jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 0,
            "loss": None,
            "created_at": str(datetime.now()),
            **job_data,
        }
        _save(jobs)
        return jobs[job_id]


def update_job(job_id: str, updates: dict) -> None:
    with _lock:
        jobs = _load()
        if job_id in jobs:
            jobs[job_id].update(updates)
            _save(jobs)


def patch_job(job_id: str, mutate) -> None:
    """Read-modify-write a single job under the lock.

    ``mutate`` receives the job dict and edits it in place. No-op if the job
    does not exist (it should always be created before dispatch).
    """
    with _lock:
        jobs = _load()
        job = jobs.get(job_id)
        if job is None:
            return
        mutate(job)
        jobs[job_id] = job
        _save(jobs)


def get_job(job_id: str):
    with _lock:
        return _load().get(job_id)


def list_jobs() -> list:
    with _lock:
        return list(_load().values())
