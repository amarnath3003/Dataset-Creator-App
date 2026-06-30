"""Streaming + blocking generation on a loaded model.

Streaming uses the canonical transformers pattern: a ``TextIteratorStreamer``
fed by ``model.generate`` running on a background thread, while the main thread
iterates the streamer and yields token deltas. Generation is cancellable
mid-flight via a ``threading.Event`` checked by a ``StoppingCriteria`` (and the
caller setting the event on client disconnect).

All torch/transformers imports are local so the module imports without the ML
stack present.
"""
from __future__ import annotations

import threading
import time
from typing import Any, Iterator, Optional

from engine import chat_format
from engine.model_manager import LoadedModel


def _stopping_criteria(stop_event: threading.Event):
    from transformers import StoppingCriteria, StoppingCriteriaList

    class _EventStop(StoppingCriteria):
        def __call__(self, input_ids, scores, **kwargs) -> bool:
            return stop_event.is_set()

    return StoppingCriteriaList([_EventStop()])


def stream_chat(
    handle: LoadedModel,
    system_prompt: Optional[str],
    history: list[dict[str, str]],
    params: dict[str, Any],
    stop_event: Optional[threading.Event] = None,
) -> Iterator[dict[str, Any]]:
    """Yield generation events for one assistant turn.

    Event shapes:
      {"type": "start", "prompt_tokens": int, "dropped_turns": int}
      {"type": "token", "text": str}
      {"type": "done", "text": str, "stats": {...}}
      {"type": "error", "message": str}
    """
    import torch
    from transformers import TextIteratorStreamer

    stop_event = stop_event or threading.Event()
    tokenizer = handle.tokenizer
    model = handle.model
    max_seq_length = int(handle.target.get("max_seq_length", 2048) or 2048)
    gen_kwargs = chat_format.sampling_kwargs(params)

    try:
        input_ids, info = chat_format.encode_for_generation(
            tokenizer,
            system_prompt,
            history,
            max_seq_length=max_seq_length,
            max_new_tokens=gen_kwargs["max_new_tokens"],
        )
        input_ids = input_ids.to(model.device)
    except Exception as exc:  # noqa: BLE001
        yield {"type": "error", "message": f"Failed to encode prompt: {exc}"}
        return

    yield {"type": "start", "prompt_tokens": info["prompt_tokens"], "dropped_turns": info["dropped_turns"]}

    streamer = TextIteratorStreamer(
        tokenizer, skip_prompt=True, skip_special_tokens=True
    )

    generate_kwargs = dict(
        input_ids=input_ids,
        streamer=streamer,
        stopping_criteria=_stopping_criteria(stop_event),
        pad_token_id=getattr(tokenizer, "pad_token_id", None) or getattr(tokenizer, "eos_token_id", None),
        **gen_kwargs,
    )

    seed = params.get("seed")
    if seed is not None:
        try:
            torch.manual_seed(int(seed))
        except Exception:
            pass

    error_box: dict[str, Any] = {}

    def _run():
        # Only one generation per model instance at a time.
        with handle.gen_lock:
            try:
                with torch.no_grad():
                    model.generate(**generate_kwargs)
            except Exception as exc:  # noqa: BLE001
                error_box["error"] = str(exc)

    thread = threading.Thread(target=_run, daemon=True)
    t_start = time.time()
    thread.start()

    pieces: list[str] = []
    ttft: Optional[float] = None
    try:
        for text in streamer:
            if not text:
                continue
            if ttft is None:
                ttft = time.time() - t_start
            pieces.append(text)
            yield {"type": "token", "text": text}
            if stop_event.is_set():
                break
    finally:
        # Ensure the worker thread observes the stop and winds down.
        stop_event.set()
        thread.join(timeout=30)

    full_text = "".join(pieces)
    gen_seconds = time.time() - t_start

    if error_box.get("error"):
        yield {"type": "error", "message": error_box["error"], "text": full_text}
        return

    completion_tokens = _count_tokens(tokenizer, full_text)
    tps = round(completion_tokens / gen_seconds, 1) if gen_seconds > 0 else 0.0
    yield {
        "type": "done",
        "text": full_text,
        "stats": {
            "prompt_tokens": info["prompt_tokens"],
            "completion_tokens": completion_tokens,
            "dropped_turns": info["dropped_turns"],
            "time_to_first_token_s": round(ttft, 3) if ttft is not None else None,
            "generation_time_s": round(gen_seconds, 2),
            "tokens_per_second": tps,
            "stopped": stop_event.is_set() and completion_tokens < gen_kwargs["max_new_tokens"],
        },
    }


def generate_full(
    handle: LoadedModel,
    system_prompt: Optional[str],
    history: list[dict[str, str]],
    params: dict[str, Any],
    stop_event: Optional[threading.Event] = None,
) -> dict[str, Any]:
    """Run a full (blocking) generation by draining ``stream_chat``.

    Returns ``{"text", "stats"}`` or raises on error. Used by Compare/Preset
    endpoints that want a single response, not a token stream.
    """
    text = ""
    stats: dict[str, Any] = {}
    for ev in stream_chat(handle, system_prompt, history, params, stop_event):
        if ev["type"] == "token":
            text += ev["text"]
        elif ev["type"] == "done":
            text = ev["text"]
            stats = ev["stats"]
        elif ev["type"] == "error":
            raise RuntimeError(ev["message"])
    return {"text": text, "stats": stats}


def _count_tokens(tokenizer, text: str) -> int:
    if not text:
        return 0
    try:
        return len(tokenizer(text, add_special_tokens=False).input_ids)
    except Exception:
        return len(text.split())
