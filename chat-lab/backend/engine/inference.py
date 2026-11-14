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


def _stream_ollama(
    handle: LoadedModel,
    system_prompt: Optional[str],
    history: list[dict[str, str]],
    params: dict[str, Any],
    stop_event: threading.Event,
) -> Iterator[dict[str, Any]]:
    import json
    import urllib.request

    model_name = (handle.model or {}).get("ollama_model") or str(handle.target.get("base_model") or "").split("ollama:", 1)[-1]
    msgs = []
    if system_prompt:
        msgs.append({"role": "system", "content": system_prompt})
    msgs.extend({"role": m.get("role", "user"), "content": m.get("content", "")} for m in history)

    prompt_tokens = max(1, sum(len((m.get("content") or "").split()) for m in msgs))
    yield {"type": "start", "prompt_tokens": prompt_tokens, "dropped_turns": 0}

    body = json.dumps(
        {
            "model": model_name,
            "messages": msgs,
            "stream": True,
            "options": {
                "temperature": float(params.get("temperature", 0.7)),
                "top_p": float(params.get("top_p", 0.9)),
                "top_k": int(params.get("top_k", 20)),
                "repeat_penalty": float(params.get("repetition_penalty", 1.1)),
                "num_predict": int(params.get("max_new_tokens", 512)),
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        "http://localhost:11434/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    t_start = time.time()
    pieces: list[str] = []
    ttft: Optional[float] = None
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            for raw_line in resp:
                if stop_event.is_set():
                    break
                line = raw_line.decode("utf-8").strip()
                if not line:
                    continue
                chunk = json.loads(line)
                delta = (chunk.get("message") or {}).get("content") or ""
                if delta:
                    if ttft is None:
                        ttft = time.time() - t_start
                    pieces.append(delta)
                    yield {"type": "token", "text": delta}
                if chunk.get("done"):
                    break
    except Exception as exc:
        yield {"type": "error", "message": f"Ollama streaming error: {exc}"}
        return

    full_text = "".join(pieces)
    gen_seconds = time.time() - t_start
    completion_tokens = max(1, len(full_text.split())) if full_text else 0
    tps = round(completion_tokens / gen_seconds, 1) if gen_seconds > 0 else 0.0
    yield {
        "type": "done",
        "text": full_text,
        "stats": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "dropped_turns": 0,
            "time_to_first_token_s": round(ttft, 3) if ttft is not None else None,
            "generation_time_s": round(gen_seconds, 2),
            "tokens_per_second": tps,
            "stopped": stop_event.is_set(),
        },
    }


def _stream_simulator(
    handle: LoadedModel,
    system_prompt: Optional[str],
    history: list[dict[str, str]],
    params: dict[str, Any],
    stop_event: threading.Event,
) -> Iterator[dict[str, Any]]:
    import re

    meta = handle.model or {}
    records = meta.get("records") or []
    last_user = next((m.get("content", "") for m in reversed(history) if m.get("role") == "user"), "").strip()
    prompt_tokens = max(4, sum(len((m.get("content") or "").split()) for m in history) + (len((system_prompt or "").split())))
    yield {"type": "start", "prompt_tokens": prompt_tokens, "dropped_turns": 0}

    stop_words = {"the", "a", "an", "is", "are", "was", "were", "in", "on", "of", "to", "for", "and", "or", "with", "what", "how", "why", "who", "when", "does", "do"}

    def _tokens(text: str) -> set[str]:
        return {w for w in re.findall(r"[a-z0-9]{2,}", text.lower()) if w not in stop_words}

    q_toks = _tokens(last_user)
    ranked: list[tuple[int, dict[str, str]]] = []
    for rec in records:
        q_txt = str(rec.get("question") or "")
        a_txt = str(rec.get("answer") or "")
        overlap = len(q_toks & (_tokens(q_txt) | _tokens(a_txt)))
        ranked.append((overlap, rec))
    ranked.sort(key=lambda x: x[0], reverse=True)

    is_finetuned = handle.target.get("kind") == "finetuned"
    label = handle.target.get("label") or handle.target.get("base_model") or "model"

    if is_finetuned and ranked and (ranked[0][0] > 0 or records):
        top_score, top = ranked[0]
        ans = top.get("answer", "").strip()
        src_q = top.get("question", "").strip()
        parts = [ans] if ans else [f"Based on the fine-tuned domain dataset ({len(records)} trained examples):"]
        if len(ranked) > 1 and ranked[1][0] > 0:
            second = ranked[1][1].get("answer", "").strip()
            if second and second != ans:
                parts.append(f"\n\nAdditional context from training knowledge: {second[:280]}")
        elif top_score == 0 and src_q:
            parts = [
                f"From the fine-tuned adapter ({label}, {len(records)} domain QA samples), the closest trained topic relates to \"{src_q[:120]}\":\n\n{ans}"
            ]
        response_text = "".join(parts)
    else:
        reason = meta.get("fallback_reason")
        if is_finetuned:
            response_text = f"[{label} · Simulated Adapter] Received prompt: \"{last_user}\". No matching QA record was stored in this adapter's domain bundle."
        else:
            note = " (domain-agnostic base model simulation)"
            if reason:
                note = " (offline/sim fallback because local weights were not cached)"
            response_text = (
                f"[{label}{note}] Here is a general baseline answer without task-specific fine-tuning:\n\n"
                f"Regarding \"{last_user or 'your prompt'}\": a generalist foundation model provides broad background knowledge, whereas a fine-tuned adapter trained on your curated dataset specializes terminology, exact facts, and response formatting."
            )

    max_tokens = max(16, int(params.get("max_new_tokens", 512) or 512))
    words = response_text.split(" ")[:max_tokens]

    t_start = time.time()
    ttft: Optional[float] = None
    pieces: list[str] = []
    with handle.gen_lock:
        for i, word in enumerate(words):
            if stop_event.is_set():
                break
            chunk = word if i == 0 else " " + word
            if ttft is None:
                ttft = time.time() - t_start
            pieces.append(chunk)
            yield {"type": "token", "text": chunk}
            time.sleep(0.014)

    full_text = "".join(pieces)
    gen_seconds = max(0.01, time.time() - t_start)
    completion_tokens = max(1, len(pieces))
    tps = round(completion_tokens / gen_seconds, 1)
    yield {
        "type": "done",
        "text": full_text,
        "stats": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "dropped_turns": 0,
            "time_to_first_token_s": round(ttft or 0.01, 3),
            "generation_time_s": round(gen_seconds, 2),
            "tokens_per_second": tps,
            "stopped": stop_event.is_set(),
        },
    }


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
    stop_event = stop_event or threading.Event()
    if handle.backend == "ollama":
        yield from _stream_ollama(handle, system_prompt, history, params, stop_event)
        return
    if handle.backend == "simulator":
        yield from _stream_simulator(handle, system_prompt, history, params, stop_event)
        return

    import torch
    from transformers import TextIteratorStreamer
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
