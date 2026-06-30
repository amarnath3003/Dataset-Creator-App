"""Model discovery + load/unload control.

Mounted at ``/api/models`` by ``main.py`` (no inner prefix). These endpoints
read JSON / inspect the GPU only — loading itself happens lazily on first chat,
but ``/load`` lets the UI warm a model and ``/unload`` frees VRAM on demand.
"""
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from services import run_registry
from engine.model_manager import MANAGER

router = APIRouter()


class LoadRequest(BaseModel):
    run_id: Optional[str] = None
    base_model: Optional[str] = None


@router.get("/finetuned")
def list_finetuned():
    """Fine-tuned runs with loadable weights on disk."""
    return run_registry.list_finetuned()


@router.get("/base")
def list_base():
    """Base foundation models from the Finetune Lab registry."""
    return run_registry.list_base_models()


@router.get("/status")
def manager_status():
    """What's resident in VRAM, GPU snapshot, whether torch is installed."""
    return MANAGER.status()


@router.post("/load")
async def load_model(req: LoadRequest):
    try:
        target = run_registry.get_target(req.run_id, req.base_model)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    try:
        handle = await run_in_threadpool(MANAGER.get, target)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Failed to load model: {exc}")
    return {"ok": True, "model": handle.public(), "status": MANAGER.status()}


@router.post("/unload")
def unload_model(req: LoadRequest):
    if req.run_id:
        key = req.run_id
    elif req.base_model:
        key = f"base:{req.base_model}"
    else:
        # No target -> free everything.
        n = MANAGER.unload_all()
        return {"ok": True, "unloaded": n, "status": MANAGER.status()}
    ok = MANAGER.unload(key)
    return {"ok": ok, "status": MANAGER.status()}
