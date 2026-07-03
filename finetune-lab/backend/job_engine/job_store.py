"""File-based job store for training runs.

Two layers guard every read/write: an in-process ``threading.Lock`` (fast path
for multiple callers inside one process) and a cross-process file lock. The
threading lock alone is NOT enough — training runs execute in a separate OS
subprocess (``workers.gpu_worker._run_subprocess`` / ``train_entry.py``), and
that subprocess patches its own job record every training step while the API
process's ``threading.Lock`` is a completely different object with no
visibility across the process boundary. Without the file lock, a subprocess
writing run A's progress and the API handling e.g. POST /stop for run B at the
same moment both read-modify-write the *entire* ``jobs.json`` dict, and
whichever finishes last silently clobbers the other's update (lost writes).
Persistence is otherwise best-effort and atomic via a temp file + replace.
"""
import json
import os
import threading
import time
from datetime import datetime
from pathlib import Path

from config import JOBS_FILE, ensure_dirs

_lock = threading.Lock()

_LOCK_PATH = JOBS_FILE.with_suffix(".json.lock")
_LOCK_STALE_SECONDS = 30
_LOCK_POLL_SECONDS = 0.05


class _CrossProcessLock:
    """Advisory cross-process mutex via exclusive file creation.

    Windows has no ``fcntl``; ``O_CREAT | O_EXCL`` is portable and needs no
    extra dependency. A lock file older than ``_LOCK_STALE_SECONDS`` is
    assumed abandoned by a crashed holder and force-taken, so a dead process
    can never wedge every future job_store call.
    """

    def __enter__(self):
        while True:
            try:
                self._fd = os.open(str(_LOCK_PATH), os.O_CREAT | os.O_EXCL | os.O_RDWR)
                return self
            except FileExistsError:
                try:
                    age = time.time() - _LOCK_PATH.stat().st_mtime
                except OSError:
                    continue
                if age > _LOCK_STALE_SECONDS:
                    try:
                        _LOCK_PATH.unlink()
                    except OSError:
                        pass
                    continue
                time.sleep(_LOCK_POLL_SECONDS)

    def __exit__(self, exc_type, exc, tb):
        try:
            os.close(self._fd)
        finally:
            try:
                _LOCK_PATH.unlink()
            except OSError:
                pass


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
    with _lock, _CrossProcessLock():
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
    with _lock, _CrossProcessLock():
        jobs = _load()
        if job_id in jobs:
            jobs[job_id].update(updates)
            _save(jobs)


def patch_job(job_id: str, mutate) -> None:
    """Read-modify-write a single job under the lock.

    ``mutate`` receives the job dict and edits it in place. No-op if the job
    does not exist (it should always be created before dispatch).
    """
    with _lock, _CrossProcessLock():
        jobs = _load()
        job = jobs.get(job_id)
        if job is None:
            return
        mutate(job)
        jobs[job_id] = job
        _save(jobs)


def delete_job(job_id: str) -> bool:
    """Remove a job record. Returns True if one was deleted."""
    with _lock, _CrossProcessLock():
        jobs = _load()
        if job_id in jobs:
            del jobs[job_id]
            _save(jobs)
            return True
        return False


def get_job(job_id: str):
    with _lock, _CrossProcessLock():
        return _load().get(job_id)


def list_jobs() -> list:
    with _lock, _CrossProcessLock():
        return list(_load().values())
