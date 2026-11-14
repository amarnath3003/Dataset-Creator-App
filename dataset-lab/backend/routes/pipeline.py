import csv
import io
import json
import logging
import re
import xml.etree.ElementTree as ET
import zipfile
import zlib
from pathlib import Path
from typing import List, Optional

from bs4 import BeautifulSoup
from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from backend.engines.chunking import chunking_engine
from backend.engines.cleaning import cleaning_engine
from backend.engines.embedding_refiner import embedding_refiner
from backend.engines.generation import generation_engine
from backend.models import GenerationConfig, PipelineConfig, RawTextPayload
from backend.utils.filesystem import get_project_path, save_raw_text

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class PipelineRunRequest(BaseModel):
    pipeline_config: PipelineConfig
    generation_config: GenerationConfig
    resume: bool = False


def _extract_docx_bytes(data: bytes) -> str:
    try:
        import docx  # type: ignore

        doc = docx.Document(io.BytesIO(data))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except ImportError:
        pass

    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        xml_bytes = zf.read("word/document.xml")
    root = ET.fromstring(xml_bytes)
    paragraphs = []
    for p in root.iter():
        if p.tag.endswith("}p"):
            texts = [t.text for t in p.iter() if t.tag.endswith("}t") and t.text]
            joined = "".join(texts).strip()
            if joined:
                paragraphs.append(joined)
    return "\n\n".join(paragraphs)


def _extract_pdf_bytes(data: bytes) -> str:
    try:
        import pypdf  # type: ignore

        reader = pypdf.PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
        return "\n\n".join(p.strip() for p in pages if p.strip())
    except ImportError:
        pass

    try:
        import fitz  # type: ignore

        doc = fitz.open(stream=data, filetype="pdf")
        return "\n\n".join(page.get_text("text").strip() for page in doc if page.get_text("text").strip())
    except ImportError:
        pass

    # Pure-Python fallback: inflate FlateDecode streams & extract Tj/TJ text operators
    chunks = []
    for match in re.finditer(rb"stream[\r\n]+(.*?)[\r\n]+endstream", data, re.DOTALL):
        raw_stream = match.group(1)
        for candidate in (raw_stream,):
            try:
                decompressed = zlib.decompress(candidate).decode("latin-1", errors="ignore")
            except Exception:
                decompressed = candidate.decode("latin-1", errors="ignore")
            literals = re.findall(r"\(([^()\\]*(?:\\.[^()\\]*)*)\)", decompressed)
            cleaned = [
                lit.replace(r"\(", "(").replace(r"\)", ")").replace(r"\\", "\\")
                for lit in literals
                if len(lit.strip()) > 1
            ]
            if cleaned:
                chunks.append(" ".join(cleaned))
    text = "\n\n".join(chunks).strip()
    if not text:
        raise ValueError(
            "Could not extract text from PDF (scanned/encrypted PDF or pypdf not installed)."
        )
    return text


def _extract_text_from_upload(filename: str, content: bytes) -> str:
    ext = Path(filename or "document.txt").suffix.lower()

    if ext == ".docx":
        return _extract_docx_bytes(content)

    if ext == ".pdf":
        return _extract_pdf_bytes(content)

    decoded = content.decode("utf-8", errors="replace")

    if ext in (".html", ".htm"):
        soup = BeautifulSoup(decoded, "html.parser")
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)

    if ext == ".csv":
        reader = csv.DictReader(io.StringIO(decoded))
        lines = []
        for row in reader:
            parts = [f"{k}: {v}" for k, v in row.items() if v is not None and str(v).strip()]
            if parts:
                lines.append(" | ".join(parts))
        return "\n".join(lines) if lines else decoded

    if ext == ".json":
        try:
            obj = json.loads(decoded)
            if isinstance(obj, list):
                rows = []
                for item in obj:
                    if isinstance(item, dict):
                        rows.append(
                            "\n".join(f"{k}: {v}" for k, v in item.items() if v is not None)
                        )
                    else:
                        rows.append(str(item))
                return "\n\n".join(rows)
            if isinstance(obj, dict):
                return json.dumps(obj, indent=2, ensure_ascii=False)
        except json.JSONDecodeError:
            pass
        return decoded

    if ext == ".jsonl":
        rows = []
        for line in decoded.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
                if isinstance(item, dict):
                    rows.append(
                        "\n".join(f"{k}: {v}" for k, v in item.items() if v is not None)
                    )
                else:
                    rows.append(str(item))
            except json.JSONDecodeError:
                rows.append(line)
        return "\n\n".join(rows)

    # .txt, .md, .markdown, .rst, .log, etc.
    return decoded


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

    try:
        resume_from = 0
        existing_qa = []

        if config.resume:
            logger.info(f"[{project_name}] Resuming pipeline from partial results...")

            partial_path = project_path / "qa_partial.json"
            if partial_path.exists():
                try:
                    with open(partial_path, "r", encoding="utf-8") as f:
                        existing_qa = json.load(f)
                except Exception:
                    existing_qa = []

            progress_path = project_path / "progress.json"
            if progress_path.exists():
                try:
                    prog = json.loads(progress_path.read_text(encoding="utf-8"))
                    resume_from = prog.get("done", 0)
                except Exception:
                    resume_from = 0

            for f_name in [".stop", "error.log"]:
                p = project_path / f_name
                if p.exists():
                    p.unlink()

        else:
            for f_name in ["qa_v1.json", "qa_partial.json", "error.log", ".stop"]:
                path = project_path / f_name
                if path.exists():
                    path.unlink()

            logger.info(f"[{project_name}] Starting Cleaning...")
            raw_path = project_path / "raw.txt"
            if not raw_path.exists():
                logger.error(f"[{project_name}] Raw text not found")
                with open(project_path / "error.log", "w", encoding="utf-8") as f:
                    f.write("raw.txt not found. Upload or scrape source material first.\n")
                return

            with open(raw_path, "r", encoding="utf-8") as f:
                raw_text = f.read()

            cleaned_text = cleaning_engine.process(raw_text)

            cleaned_path = project_path / "cleaned.txt"
            with open(cleaned_path, "w", encoding="utf-8") as f:
                f.write(cleaned_text)

            logger.info(
                f"[{project_name}] Starting Chunking (method={config.pipeline_config.chunking_method})..."
            )
            chunks = chunking_engine.chunk(
                cleaned_text,
                chunk_size=config.pipeline_config.chunk_size,
                chunk_overlap=config.pipeline_config.chunk_overlap,
                method=config.pipeline_config.chunking_method,
            )

            logger.info(f"[{project_name}] Starting Refinement...")
            chunks = embedding_refiner.refine(
                chunks,
                threshold=config.pipeline_config.similarity_threshold,
                max_chunk_tokens=int(config.pipeline_config.chunk_size * 1.5),
            )

            chunks_path = project_path / "chunks.json"
            with open(chunks_path, "w", encoding="utf-8") as f:
                json.dump(chunks, f, indent=2, ensure_ascii=False)

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
async def upload_text(
    project_name: str,
    file: Optional[UploadFile] = File(default=None),
    files: Optional[List[UploadFile]] = File(default=None),
    mode: str = Query(default="overwrite"),
):
    incoming: List[UploadFile] = []
    if files:
        incoming.extend(files)
    if file is not None:
        incoming.append(file)
    if not incoming:
        raise HTTPException(status_code=400, detail="No file uploaded")

    extracted_parts = []
    processed_names = []
    try:
        for uf in incoming:
            raw_bytes = await uf.read()
            text = _extract_text_from_upload(uf.filename or "file.txt", raw_bytes)
            if text.strip():
                header = f"# Source: {uf.filename}\n\n" if len(incoming) > 1 else ""
                extracted_parts.append(header + text.strip())
                processed_names.append(uf.filename)

        if not extracted_parts:
            raise HTTPException(
                status_code=400, detail="Uploaded file(s) contained no extractable text."
            )

        combined = "\n\n---\n\n".join(extracted_parts)
        save_raw_text(project_name, combined, mode=mode)
        return {
            "message": f"Ingested {len(processed_names)} file(s) successfully",
            "files": processed_names,
            "chars": len(combined),
            "mode": mode,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_name}/raw_text")
def get_raw_text(project_name: str):
    project_path = get_project_path(project_name)
    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    raw_path = project_path / "raw.txt"
    if not raw_path.exists():
        return {"text": "", "chars": 0, "words": 0, "lines": 0}
    text = raw_path.read_text(encoding="utf-8", errors="replace")
    return {
        "text": text,
        "chars": len(text),
        "words": len(text.split()),
        "lines": len(text.splitlines()),
    }


@router.post("/{project_name}/raw_text")
def update_raw_text(project_name: str, payload: RawTextPayload):
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty")
    save_raw_text(project_name, payload.text, mode=payload.mode)
    raw_path = get_project_path(project_name) / "raw.txt"
    text = raw_path.read_text(encoding="utf-8", errors="replace")
    return {
        "message": "Raw corpus saved successfully",
        "chars": len(text),
        "words": len(text.split()),
        "lines": len(text.splitlines()),
    }


@router.post("/{project_name}/run")
def run_pipeline(
    project_name: str, config: PipelineRunRequest, background_tasks: BackgroundTasks
):
    project_path = get_project_path(project_name)
    if (project_path / ".running").exists():
        raise HTTPException(
            status_code=409, detail="Pipeline already running for this project"
        )

    (project_path / ".running").touch()
    background_tasks.add_task(run_pipeline_task, project_name, config)
    return {"message": "Pipeline started in background"}


@router.post("/{project_name}/stop")
def stop_pipeline(project_name: str):
    project_path = get_project_path(project_name)
    if not (project_path / ".running").exists():
        return {"message": "No active pipeline to stop"}

    (project_path / ".stop").touch()
    return {"message": "Stop signal sent"}


@router.get("/{project_name}/status")
def get_project_status(project_name: str):
    project_path = get_project_path(project_name)

    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")

    running = (project_path / ".running").exists()
    has_qa = (project_path / "qa_v1.json").exists()
    has_error = (project_path / "error.log").exists()
    has_partial = (project_path / "qa_partial.json").exists()
    has_raw = (project_path / "raw.txt").exists()
    has_cleaned = (project_path / "cleaned.txt").exists()
    has_chunks = (project_path / "chunks.json").exists()

    stopped = has_partial and not running
    finished = not running and has_qa

    progress = None
    progress_path = project_path / "progress.json"
    if progress_path.exists():
        try:
            progress = json.loads(progress_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    return {
        "raw": has_raw,
        "cleaned": has_cleaned,
        "chunked": has_chunks,
        "generated": has_qa,
        "error": has_error,
        "has_raw": has_raw,
        "has_cleaned": has_cleaned,
        "has_chunks": has_chunks,
        "has_qa": has_qa,
        "has_error": has_error,
        "has_partial": has_partial,
        "running": running,
        "stopped": stopped,
        "finished": finished,
        "qa_count": _get_qa_count(project_path),
        "chunk_count": _get_chunk_count(project_path),
        "progress": progress,
    }


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
