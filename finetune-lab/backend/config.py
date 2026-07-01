"""Central path / storage configuration for the Finetune Lab backend.

Everything resolves against the backend directory (this file's location) instead
of the current working directory, so runs and job state land in a stable place no
matter how the server is launched.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent                 # .../finetune-lab/backend
REPO_ROOT = BASE_DIR.parent.parent                          # .../Dataset-Creator-App

STORAGE_DIR = BASE_DIR / "storage"
RUNS_DIR = STORAGE_DIR / "runs"
DATASETS_DIR = STORAGE_DIR / "datasets"
EXPORTS_DIR = STORAGE_DIR / "exports"
JOBS_FILE = STORAGE_DIR / "jobs.json"
EXPORTS_FILE = STORAGE_DIR / "exports.json"

MODELS_FILE = BASE_DIR / "model_registry" / "models.json"

# Dataset Lab exports (sibling project) — surfaced in the dataset picker (Phase 2).
DATASET_LAB_PROJECTS = REPO_ROOT / "dataset-lab" / "projects"


def ensure_dirs() -> None:
    for directory in (STORAGE_DIR, RUNS_DIR, DATASETS_DIR, EXPORTS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


# Create the storage tree as soon as the config is imported.
ensure_dirs()
