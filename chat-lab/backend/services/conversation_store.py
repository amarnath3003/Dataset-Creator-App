"""File-based conversation persistence.

One JSON file per conversation under ``storage/conversations/{id}.json``. Simple,
inspectable, and matches the file-based philosophy of the other labs. Also
renders a conversation to Markdown for export.
"""
from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime
from typing import Any, Optional

from config import CONVERSATIONS_DIR, ensure_dirs

_lock = threading.Lock()


def _path(conv_id: str):
    return CONVERSATIONS_DIR / f"{conv_id}.json"


def _now() -> str:
    return datetime.now().isoformat(timespec="seconds")


def save(conv: dict[str, Any]) -> dict[str, Any]:
    """Create or update a conversation. Assigns id/timestamps as needed."""
    ensure_dirs()
    with _lock:
        conv_id = conv.get("id") or str(uuid.uuid4())
        conv["id"] = conv_id
        existing = _read(conv_id)
        conv["created_at"] = (existing or {}).get("created_at") or conv.get("created_at") or _now()
        conv["updated_at"] = _now()
        if not conv.get("title"):
            conv["title"] = _derive_title(conv)
        tmp = _path(conv_id).with_suffix(".json.tmp")
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(conv, f, indent=2, ensure_ascii=False, default=str)
        tmp.replace(_path(conv_id))
        return conv


def _read(conv_id: str) -> Optional[dict[str, Any]]:
    try:
        with open(_path(conv_id), "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return None


def get(conv_id: str) -> Optional[dict[str, Any]]:
    with _lock:
        return _read(conv_id)


def delete(conv_id: str) -> bool:
    with _lock:
        path = _path(conv_id)
        if path.exists():
            path.unlink()
            return True
        return False


def list_all() -> list[dict[str, Any]]:
    """Lightweight index of all conversations (no message bodies)."""
    ensure_dirs()
    out: list[dict[str, Any]] = []
    with _lock:
        for path in CONVERSATIONS_DIR.glob("*.json"):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    conv = json.load(f)
            except (json.JSONDecodeError, OSError):
                continue
            out.append(
                {
                    "id": conv.get("id"),
                    "title": conv.get("title"),
                    "created_at": conv.get("created_at"),
                    "updated_at": conv.get("updated_at"),
                    "model_label": (conv.get("target") or {}).get("label"),
                    "message_count": len(conv.get("messages") or []),
                }
            )
    out.sort(key=lambda c: (c.get("updated_at") or ""), reverse=True)
    return out


def _derive_title(conv: dict[str, Any]) -> str:
    for m in conv.get("messages") or []:
        if m.get("role") == "user" and m.get("content"):
            text = m["content"].strip().replace("\n", " ")
            return (text[:48] + "…") if len(text) > 48 else text
    return "New conversation"


def to_markdown(conv: dict[str, Any]) -> str:
    target = conv.get("target") or {}
    lines = [
        f"# {conv.get('title', 'Conversation')}",
        "",
        f"- **Model:** {target.get('label', target.get('base_model', 'unknown'))}",
        f"- **Created:** {conv.get('created_at', '')}",
    ]
    if conv.get("system_prompt"):
        lines += ["", "## System prompt", "", "```", conv["system_prompt"], "```"]
    lines += ["", "## Transcript", ""]
    for m in conv.get("messages") or []:
        role = m.get("role", "user").capitalize()
        lines.append(f"**{role}:**")
        lines.append("")
        lines.append(m.get("content", ""))
        stats = m.get("stats")
        if stats:
            lines.append(
                f"\n> _{stats.get('completion_tokens', '?')} tokens · "
                f"{stats.get('tokens_per_second', '?')} tok/s · "
                f"TTFT {stats.get('time_to_first_token_s', '?')}s_"
            )
        lines.append("")
    return "\n".join(lines)
