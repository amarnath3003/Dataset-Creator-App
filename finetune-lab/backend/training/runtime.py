"""Tiny distributed-runtime helpers (torch-free).

Used to gate telemetry to a single process under multi-GPU (DDP) runs launched
via ``accelerate``. In single-process runs none of these env vars are set, so
``is_main_process()`` is always True.
"""
import os


def is_main_process() -> bool:
    """True on global rank 0, or in any non-distributed run."""
    return os.environ.get("RANK", os.environ.get("LOCAL_RANK", "0")) == "0"
