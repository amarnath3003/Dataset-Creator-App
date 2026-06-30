"""Central path / storage configuration for the Chat Lab backend.

Everything resolves against the backend directory (this file's location) instead
of the current working directory, so conversations and caches land in a stable
place no matter how the server is launched.

Chat Lab is the third lab in the pipeline (Dataset Lab -> Finetune Lab -> Chat
Lab). It does not train anything; it *reads* the finished runs produced by
Finetune Lab and lets the user chat with them. So a few paths point sideways
into the sibling ``finetune-lab`` project.
"""
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent                 # .../chat-lab/backend
REPO_ROOT = BASE_DIR.parent.parent                          # .../Dataset-Creator-App

# Chat Lab's own storage (conversations, presets).
STORAGE_DIR = BASE_DIR / "storage"
CONVERSATIONS_DIR = STORAGE_DIR / "conversations"
PRESETS_FILE = STORAGE_DIR / "presets.json"

# --- Sideways into Finetune Lab -------------------------------------------------
# Finetune Lab writes every finished run to ``finetune-lab/backend/storage/runs``
# and records job state in ``jobs.json``. We read both to discover chat-able
# models. These mirror finetune-lab/backend/config.py exactly.
FINETUNE_BACKEND = REPO_ROOT / "finetune-lab" / "backend"
FINETUNE_RUNS_DIR = FINETUNE_BACKEND / "storage" / "runs"
FINETUNE_JOBS_FILE = FINETUNE_BACKEND / "storage" / "jobs.json"
FINETUNE_MODELS_FILE = FINETUNE_BACKEND / "model_registry" / "models.json"

# Where HuggingFace caches base weights (shared with Finetune Lab if set).
HF_HOME = None  # honour the environment's HF_HOME / default cache by leaving None


def ensure_dirs() -> None:
    for directory in (STORAGE_DIR, CONVERSATIONS_DIR):
        directory.mkdir(parents=True, exist_ok=True)


# Create the storage tree as soon as the config is imported.
ensure_dirs()
