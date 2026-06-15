from fastapi import APIRouter, File, UploadFile, BackgroundTasks, HTTPException
from pydantic import BaseModel
from pathlib import Path
from backend.utils.filesystem import get_project_path, save_raw_text
from backend.engines.cleaning import cleaning_engine
from backend.engines.chunking import chunking_engine
from backend.engines.embedding_refiner import embedding_refiner
from backend.engines.generation import generation_engine
from backend.models import GenerationConfig, PipelineConfig
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class PipelineRunRequest(BaseModel):
    pipeline_config: PipelineConfig
    generation_config: GenerationConfig
    resume: bool = False


def _get_qa_count(project_path: Path) -> int:
    qa_path = project_path / "qa_v1.json"
    if not qa_path.exists():
        qa_path = project_path / "qa_partial.json"
    if qa_path.exists():
        try:
            with open(qa_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return len(data) if isinstance(data, list) else 0
        except Exception:
            return 0
    return 0


def _get_chunk_count(project_path: Path) -> int:
    chunks_path = project_path / "chunks.json"
    if chunks_path.exists():
        try:
            with open(chunks_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return len(data) if isinstance(data, list) else 0
        except Exception:
            return 0
    return 0


def run_pipeline_task(project_name: str, config: PipelineRunRequest):
    project_path = get_project_path(project_name)
    running_file = project_path / ".running"
    running_file.touch()

    try:
        resume_from = 0
        existing_qa = []

        if config.resume:
            # ── RESUME MODE ──────────────────────────────────────────────────
            # Skip cleaning / chunking / refining. Use existing chunks.
            logger.info(f"[{project_name}] Resuming pipeline from partial results...")

            # Load existing partial QA pairs
            partial_path = project_path / "qa_partial.json"
            if partial_path.exists():
                try:
                    with open(partial_path, "r", encoding="utf-8") as f:
                        existing_qa = json.load(f)
                except Exception:
                    existing_qa = []

            # Estimate how many chunks were already processed by looking at progress.json
            progress_path = project_path / "progress.json"
            if progress_path.exists():
                try:
                    prog = json.loads(progress_path.read_text(encoding="utf-8"))
                    resume_from = prog.get("done", 0)
                except Exception:
                    resume_from = 0

            # Clean up stop flag so the generation loop won't bail immediately
            for f_name in [".stop", "error.log"]:
                p = project_path / f_name
                if p.exists():
                    p.unlink()

        else:
            # ── FRESH RUN ─────────────────────────────────────────────────────
            # Pre-run cleanup: Delete old results
            for f_name in ["qa_v1.json", "qa_partial.json", "error.log", ".stop"]:
                path = project_path / f_name
                if path.exists():
                    path.unlink()

            # 1. Clean
            logger.info(f"[{project_name}] Starting Cleaning...")
            raw_path = project_path / "raw.txt"
            if not raw_path.exists():
                logger.error(f"[{project_name}] Raw text not found")
                return

            with open(raw_path, "r", encoding="utf-8") as f:
                raw_text = f.read()

            cleaned_text = cleaning_engine.process(raw_text)

            cleaned_path = project_path / "cleaned.txt"
            with open(cleaned_path, "w", encoding="utf-8") as f:
                f.write(cleaned_text)

            # 2. Chunk
            logger.info(f"[{project_name}] Starting Chunking...")
            chunks = chunking_engine.chunk(
                cleaned_text,
                chunk_size=config.pipeline_config.chunk_size,
                chunk_overlap=config.pipeline_config.chunk_overlap,
            )

            # 3. Refine
            logger.info(f"[{project_name}] Starting Refinement...")
            chunks = embedding_refiner.refine(
                chunks, threshold=config.pipeline_config.similarity_threshold
            )

            chunks_path = project_path / "chunks.json"
            with open(chunks_path, "w", encoding="utf-8") as f:
                json.dump(chunks, f, indent=2)

        # 4. Generate (shared by both paths)
        logger.info(
            f"[{project_name}] Starting Generation (resume_from={resume_from})..."
        )
        generation_engine.generate(
            project_path,
            config.generation_config,
            resume_from=resume_from,
            existing_qa=existing_qa,
        )
        logger.info(f"[{project_name}] Pipeline Complete.")

    except Exception as e:
        logger.error(f"[{project_name}] Pipeline Failed: {e}")
        import traceback

        error_msg = f"{str(e)}\n{traceback.format_exc()}"
        with open(project_path / "error.log", "w", encoding="utf-8") as f:
            f.write(error_msg)
    finally:
        if running_file.exists():
            running_file.unlink()


@router.post("/{project_name}/upload")
async def upload_text(project_name: str, file: UploadFile = File(...)):
    try:
        content = await file.read()
        # Decode utf-8
        text = content.decode("utf-8")
        save_raw_text(project_name, text)
        return {"message": "Text uploaded successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_name}/run")
def run_pipeline(
    project_name: str, config: PipelineRunRequest, background_tasks: BackgroundTasks
):
    project_path = get_project_path(project_name)
    if (project_path / ".running").exists():
        raise HTTPException(
            status_code=409, detail="Pipeline already running for this project"
        )

    background_tasks.add_task(run_pipeline_task, project_name, config)
    return {"message": "Pipeline started in background"}


@router.post("/{project_name}/stop")
def stop_pipeline(project_name: str):
    project_path = get_project_path(project_name)
    if not (project_path / ".running").exists():
        return {"message": "No active pipeline to stop"}

    # Create stop flag
    (project_path / ".stop").touch()
    return {"message": "Stop signal sent"}


@router.get("/{project_name}/status")
def get_project_status(project_name: str):
    project_path = get_project_path(project_name)

    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    # ── File-based state detection ─────────────────────────────────────────
    running = (project_path / ".running").exists()
    has_qa = (project_path / "qa_v1.json").exists()
    has_error = (project_path / "error.log").exists()
    has_partial = (project_path / "qa_partial.json").exists()
    has_raw = (project_path / "raw.txt").exists()
    has_cleaned = (project_path / "cleaned.txt").exists()
    has_chunks = (project_path / "chunks.json").exists()

    stopped = has_partial and not running
    # finished = pipeline done successfully (has QA, not actively running)
    # NOTE: we intentionally ignore has_error here — a stale error.log from a
    # previous partial run must not block the 'Complete' state.
    finished = not running and has_qa

    # ── Optional progress.json ─────────────────────────────────────────────
    progress = None
    progress_path = project_path / "progress.json"
    if progress_path.exists():
        try:
            progress = json.loads(progress_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    return {
        # ── canonical aliases ─────────────────────────────────────────────
        "raw": has_raw,
        "cleaned": has_cleaned,
        "chunked": has_chunks,
        "generated": has_qa,
        "error": has_error,
        # ── has_* aliases (used by frontend) ────────────────────────────
        "has_raw": has_raw,
        "has_cleaned": has_cleaned,
        "has_chunks": has_chunks,
        "has_qa": has_qa,
        "has_error": has_error,
        "has_partial": has_partial,
        # ── state flags ──────────────────────────────────────────────────
        "running": running,
        "stopped": stopped,
        "finished": finished,
        # ── counts & progress ────────────────────────────────────────────
        "qa_count": _get_qa_count(project_path),
        "chunk_count": _get_chunk_count(project_path),
        "progress": progress,
    }


# ── Read-only data preview endpoints (no pipeline logic) ──────────────────────


@router.get("/{project_name}/data/cleaned")
def get_cleaned_text(project_name: str):
    project_path = get_project_path(project_name)
    cleaned_path = project_path / "cleaned.txt"
    raw_path = project_path / "raw.txt"
    if not cleaned_path.exists():
        raise HTTPException(status_code=404, detail="Cleaned text not available yet")
    cleaned_text = cleaned_path.read_text(encoding="utf-8")
    raw_length = (
        len(raw_path.read_text(encoding="utf-8")) if raw_path.exists() else None
    )
    return {
        "cleaned_text": cleaned_text,
        "cleaned_length": len(cleaned_text),
        "raw_length": raw_length,
    }


@router.get("/{project_name}/data/chunks")
def get_chunks(project_name: str):
    project_path = get_project_path(project_name)
    chunks_path = project_path / "chunks.json"
    if not chunks_path.exists():
        raise HTTPException(status_code=404, detail="Chunks not available yet")
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
    return {"chunks": chunks, "count": len(chunks)}


@router.get("/{project_name}/data/qa")
def get_qa_pairs(project_name: str):
    project_path = get_project_path(project_name)
    qa_path = project_path / "qa_v1.json"
    if not qa_path.exists():
        raise HTTPException(status_code=404, detail="QA pairs not available yet")
    pairs = json.loads(qa_path.read_text(encoding="utf-8"))
    return {"qa_pairs": pairs, "count": len(pairs)}
