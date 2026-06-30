"""Render a conversation into model-ready input ids.

The golden rule (confirmed by the HF chat-templating docs): always use the
*model's own* tokenizer template and set ``add_generation_prompt=True`` for
inference, otherwise the model may continue the user's turn instead of replying.
We never hardcode a chat format — each fine-tuned model carries the template it
was trained on in its saved tokenizer.

This module only touches a tokenizer object that is handed to it, so it stays
free of any top-level torch/transformers import.
"""
from __future__ import annotations

from typing import Any


def build_messages(system_prompt: str | None, history: list[dict[str, str]]) -> list[dict[str, str]]:
    """Assemble the OpenAI-style message list (role/content dicts)."""
    messages: list[dict[str, str]] = []
    if system_prompt and system_prompt.strip():
        messages.append({"role": "system", "content": system_prompt.strip()})
    for turn in history:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant", "system") and content is not None:
            messages.append({"role": role, "content": content})
    return messages


def _render(tokenizer, messages: list[dict[str, str]]) -> str:
    """Apply the tokenizer's chat template; fall back to a generic format."""
    if hasattr(tokenizer, "apply_chat_template") and getattr(tokenizer, "chat_template", None):
        return tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
    # Fallback for base models with no chat template.
    parts = []
    for m in messages:
        parts.append(f"{m['role'].upper()}: {m['content']}")
    parts.append("ASSISTANT:")
    return "\n".join(parts)


def encode_for_generation(
    tokenizer,
    system_prompt: str | None,
    history: list[dict[str, str]],
    max_seq_length: int,
    max_new_tokens: int,
):
    """Return ``(input_ids_tensor, info)`` ready for ``model.generate``.

    Trims the oldest *non-system* turns until the prompt leaves room for
    ``max_new_tokens`` within the model's context window. ``info`` reports the
    prompt token count and how many turns were dropped (surfaced to the UI).
    """
    import torch  # local import: encoding happens only when a model is loaded

    system = [m for m in build_messages(system_prompt, []) ]  # system only
    convo = [m for m in build_messages(None, history)]

    budget = max(256, int(max_seq_length) - int(max_new_tokens))
    dropped = 0

    while True:
        messages = system + convo
        text = _render(tokenizer, messages)
        input_ids = tokenizer(text, return_tensors="pt").input_ids
        if input_ids.shape[-1] <= budget or len(convo) <= 1:
            break
        # Drop the oldest turn (keep the most recent context + system).
        convo = convo[1:]
        dropped += 1

    info = {
        "prompt_tokens": int(input_ids.shape[-1]),
        "dropped_turns": dropped,
        "context_budget": budget,
    }
    return input_ids, info


def sampling_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    """Translate UI generation params into ``model.generate`` kwargs.

    Defaults are Qwen-style sane values. ``temperature == 0`` -> greedy decoding.
    """
    temperature = float(params.get("temperature", 0.7))
    max_new_tokens = int(params.get("max_new_tokens", 512))

    kwargs: dict[str, Any] = {
        "max_new_tokens": max_new_tokens,
        "repetition_penalty": float(params.get("repetition_penalty", 1.1)),
    }

    if temperature and temperature > 0:
        kwargs.update(
            do_sample=True,
            temperature=temperature,
            top_p=float(params.get("top_p", 0.9)),
            top_k=int(params.get("top_k", 20)),
        )
    else:
        kwargs.update(do_sample=False)

    return kwargs
