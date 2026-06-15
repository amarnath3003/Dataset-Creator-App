from pydantic import BaseModel, Field
from typing import Optional, Dict, Any


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, pattern="^[a-zA-Z0-9_-]+$")


class PipelineConfig(BaseModel):
    chunk_size: int = Field(default=800, ge=200, le=2000)
    chunk_overlap: int = Field(default=100, ge=0)
    similarity_threshold: float = Field(default=0.92, ge=0.0, le=1.0)


class GenerationConfig(BaseModel):
    model_name: str
    provider: str = "local"  # "local", "openai", "anthropic"
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = None
    top_p: float = Field(default=1.0)
    frequency_penalty: float = Field(default=0.0)
    presence_penalty: float = Field(default=0.0)
    domain: str = "general"
    format: str = "alpaca"
    api_key: Optional[str] = (
        None  # User-supplied key (takes priority over OPENAI_API_KEY env var)
    )
    qa_density_factor: float = Field(default=1.0, ge=0.5, le=3.0)


class Chunk(BaseModel):
    chunk_id: int
    text: str
    token_count: int


class QAPair(BaseModel):
    instruction: str
    input: str
    output: str


class ProjectStatus(BaseModel):
    has_raw: bool
    has_cleaned: bool
    has_chunks: bool
    has_qa: bool
    chunk_count: int
    qa_count: int
    running: bool = False
    stopped: bool = False
    has_error: bool = False
    progress: Optional[Dict[str, Any]] = None
    finished: bool = False


class PromptUpdateRequest(BaseModel):
    prompt: str
