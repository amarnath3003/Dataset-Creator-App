"""Chat Lab API.

Third lab in the pipeline (Dataset Lab -> Finetune Lab -> Chat Lab). Lets the
user chat with and compare the models produced by Finetune Lab. Heavy ML imports
are deferred inside the engine, so this API boots even on a machine without
torch/unsloth installed (the model list still works; loading reports a clear
error).
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import chat_routes, model_routes, conversation_routes

app = FastAPI(
    title="Chat Lab API",
    description="Chat with and compare your fine-tuned models",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(model_routes.router, prefix="/api/models", tags=["Models"])
app.include_router(chat_routes.router, prefix="/api/chat", tags=["Chat"])
app.include_router(conversation_routes.router, prefix="/api/conversations", tags=["Conversations"])


@app.get("/")
def read_root():
    return {"status": "ok", "service": "Chat Lab API"}
