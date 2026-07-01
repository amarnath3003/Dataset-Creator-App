"""Export API — turn a finished run into an adapter / merged / GGUF / Hub artifact.

The actual work runs in a background task (``export_worker``) that lazily imports
the ML stack; these handlers only touch the file-based ``export_store``.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field

from services import export_service
from job_engine import export_store

router = APIRouter()


class ExportRequest(BaseModel):
    run_id: str
    kind: str  # adapter | merged_16bit | gguf | hub
    options: Dict[str, Any] = Field(default_factory=dict)


@router.post("/create")
def create_export(req: ExportRequest, background_tasks: BackgroundTasks):
    try:
        result = export_service.create_export(req.run_id, req.kind, req.options)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    background_tasks.add_task(export_service.dispatch, result["payload"])
    return {"ok": True, "export_id": result["export_id"], "status": "queued"}


@router.get("/status/{export_id}")
def export_status(export_id: str):
    exp = export_store.get_export(export_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Export not found")
    return exp


@router.get("/run/{run_id}")
def exports_for_run(run_id: str):
    exports = export_store.list_for_run(run_id)
    exports.sort(key=lambda e: str(e.get("created_at", "")), reverse=True)
    return exports


@router.get("/list")
def list_all_exports():
    exports = export_store.list_exports()
    exports.sort(key=lambda e: str(e.get("created_at", "")), reverse=True)
    return exports


@router.delete("/{export_id}")
def delete_export(export_id: str):
    exp = export_store.get_export(export_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Export not found")
    if exp.get("status") == "running":
        raise HTTPException(status_code=409, detail="Export is still running.")
    export_store.delete_export(export_id)
    return {"ok": True, "deleted": export_id}


# --- Backwards-compatible thin aliases (previously stubbed) -------------------
class LegacyExport(BaseModel):
    run_id: str
    options: Optional[Dict[str, Any]] = None


@router.post("/hf")
def export_to_hf(req: LegacyExport, background_tasks: BackgroundTasks):
    return create_export(ExportRequest(run_id=req.run_id, kind="hub", options=req.options or {}), background_tasks)


@router.post("/gguf")
def export_to_gguf(req: LegacyExport, background_tasks: BackgroundTasks):
    return create_export(ExportRequest(run_id=req.run_id, kind="gguf", options=req.options or {}), background_tasks)
