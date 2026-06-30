"""Conversation persistence + export. Mounted at ``/api/conversations``."""
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field

from services import conversation_store

router = APIRouter()


class ConversationBody(BaseModel):
    id: Optional[str] = None
    title: Optional[str] = None
    target: dict[str, Any] = Field(default_factory=dict)
    system_prompt: Optional[str] = None
    params: dict[str, Any] = Field(default_factory=dict)
    messages: list[dict[str, Any]] = Field(default_factory=list)


@router.get("")
def list_conversations():
    return conversation_store.list_all()


@router.get("/{conv_id}")
def get_conversation(conv_id: str):
    conv = conversation_store.get(conv_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv


@router.post("")
def save_conversation(body: ConversationBody):
    return conversation_store.save(body.model_dump())


@router.delete("/{conv_id}")
def delete_conversation(conv_id: str):
    ok = conversation_store.delete(conv_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"ok": True}


@router.get("/{conv_id}/export.md", response_class=PlainTextResponse)
def export_markdown(conv_id: str):
    conv = conversation_store.get(conv_id)
    if conv is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation_store.to_markdown(conv)
