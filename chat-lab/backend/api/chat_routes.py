"""Chat generation: streaming (SSE), stop, and side-by-side compare.

Streaming runs the blocking generator (model load + token stream) on a worker
thread that pushes events into an asyncio queue; the endpoint relays them as SSE
and, if the browser disconnects, sets the stop event so the GPU stops promptly.
"""
from __future__ import annotations

import asyncio
import json
import threading
import uuid
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services import run_registry
from engine import inference
from engine.model_manager import MANAGER

router = APIRouter()

# Active generations: stream_id -> stop Event (so /stop can cancel mid-stream).
_ACTIVE: dict[str, threading.Event] = {}
_ACTIVE_LOCK = threading.Lock()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------
class GenParams(BaseModel):
    temperature: float = 0.7
    top_p: float = 0.9
    top_k: int = 20
    repetition_penalty: float = 1.1
    max_new_tokens: int = 512
    seed: Optional[int] = None


class Message(BaseModel):
    role: str
    content: str


class StreamRequest(BaseModel):
    run_id: Optional[str] = None
    base_model: Optional[str] = None
    system_prompt: Optional[str] = None
    messages: list[Message] = Field(default_factory=list)
    params: GenParams = Field(default_factory=GenParams)
    stream_id: Optional[str] = None


class StopRequest(BaseModel):
    stream_id: str


class CompareTarget(BaseModel):
    run_id: Optional[str] = None
    base_model: Optional[str] = None


class CompareRequest(BaseModel):
    targets: list[CompareTarget]
    system_prompt: Optional[str] = None
    messages: list[Message] = Field(default_factory=list)
    params: GenParams = Field(default_factory=GenParams)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _sse(event: dict[str, Any]) -> str:
    return f"data: {json.dumps(event, ensure_ascii=False, default=str)}\n\n"


def _register(stream_id: str) -> threading.Event:
    ev = threading.Event()
    with _ACTIVE_LOCK:
        _ACTIVE[stream_id] = ev
    return ev


def _unregister(stream_id: str) -> None:
    with _ACTIVE_LOCK:
        _ACTIVE.pop(stream_id, None)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.post("/stream")
async def stream(req: StreamRequest, request: Request):
    try:
        target = run_registry.get_target(req.run_id, req.base_model)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    stream_id = req.stream_id or str(uuid.uuid4())
    stop_event = _register(stream_id)
    history = [m.model_dump() for m in req.messages]
    params = req.params.model_dump()
    system_prompt = req.system_prompt

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def producer() -> None:
        """Load (if needed) then stream tokens — all on a worker thread."""
        def push(ev: dict[str, Any]) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, ev)

        try:
            handle = MANAGER.get(target)
            push({"type": "ready", "model": handle.public()})
            for ev in inference.stream_chat(handle, system_prompt, history, params, stop_event):
                push(ev)
        except Exception as exc:  # noqa: BLE001
            push({"type": "error", "message": str(exc)})
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

    threading.Thread(target=producer, daemon=True).start()

    async def event_source():
        yield _sse({"type": "meta", "stream_id": stream_id})
        try:
            while True:
                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=0.5)
                except asyncio.TimeoutError:
                    if await request.is_disconnected():
                        stop_event.set()
                    continue
                if ev is None:
                    break
                yield _sse(ev)
        finally:
            stop_event.set()
            _unregister(stream_id)

    return StreamingResponse(
        event_source(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/stop")
def stop(req: StopRequest):
    with _ACTIVE_LOCK:
        ev = _ACTIVE.get(req.stream_id)
    if ev is None:
        return {"ok": False, "detail": "No active stream with that id."}
    ev.set()
    return {"ok": True}


@router.post("/compare")
async def compare(req: CompareRequest):
    """Generate one response from each target for the same prompt.

    Two targets is the common case (base vs fine-tuned, or A/B checkpoints). We
    ask the manager to hold all targets resident at once; on a tight GPU a load
    may OOM, which is reported per-target rather than failing the whole request.
    """
    if not req.targets:
        raise HTTPException(status_code=400, detail="Provide at least one target.")

    resolved = []
    for t in req.targets:
        try:
            resolved.append(run_registry.get_target(t.run_id, t.base_model))
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc))

    history = [m.model_dump() for m in req.messages]
    params = req.params.model_dump()
    system_prompt = req.system_prompt
    min_cap = min(len(resolved), 2)

    def run_all() -> list[dict[str, Any]]:
        results = []
        for target in resolved:
            entry: dict[str, Any] = {"target": {"label": target.get("label"), "run_id": target.get("run_id"), "base_model": target.get("base_model")}}
            try:
                handle = MANAGER.get(target, min_capacity=min_cap)
                out = inference.generate_full(handle, system_prompt, history, params)
                entry.update(text=out["text"], stats=out["stats"])
            except Exception as exc:  # noqa: BLE001
                entry["error"] = str(exc)
            results.append(entry)
        return results

    results = await run_in_threadpool(run_all)
    return {"results": results}
