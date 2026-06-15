import json
import re
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from backend.models import GenerationConfig
from backend.llm.base import LLMProvider
from backend.llm.local import LocalLLM
from backend.llm.openai import OpenAILLM

logger = logging.getLogger(__name__)


class GenerationEngine:
    def __init__(self):
        self.formats_path = Path(__file__).parent.parent / "formats" / "formats.json"

    def _get_provider(self, config: GenerationConfig) -> LLMProvider:
        providers = {
            "openai": OpenAILLM,
            "ollama": LocalLLM,
            "local": LocalLLM,
        }

        provider_class = providers.get(config.provider.lower())
        if not provider_class:
            raise ValueError(
                f"Unsupported LLM provider: '{config.provider}'. Available: {list(providers.keys())}"
            )

        return provider_class()

    def _write_error(self, project_path: Path, message: str):
        """Write a generation error to error.log so the UI can surface it."""
        error_log = project_path / "error.log"
        logger.error(message)
        with open(error_log, "a", encoding="utf-8") as f:
            f.write(message + "\n")

    def _atomic_write_json(self, file_path: Path, data: Any):
        """Atomically write JSON to avoid read race conditions during front-end polling."""
        import time

        temp_path = file_path.with_suffix(".tmp")
        try:
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2 if isinstance(data, list) else None)
            # Retry loop for Windows strict file locking
            for attempt in range(5):
                try:
                    temp_path.replace(file_path)
                    break
                except PermissionError:
                    if attempt == 4:
                        logger.error(
                            f"Atomic write failed for {file_path} due to persistent lock."
                        )
                    time.sleep(0.1)
        except Exception as e:
            logger.error(f"Atomic write failed for {file_path}: {e}")
        finally:
            temp_path.unlink(missing_ok=True)

    def _write_progress(self, project_path: Path, done: int, total: int, status: str):
        """Write live progress info so the frontend can poll it."""
        progress = {
            "done": done,
            "total": total,
            "percent": round(done / total * 100, 1) if total else 0,
            "status": status,
        }
        try:
            self._atomic_write_json(project_path / "progress.json", progress)
        except Exception:
            pass

    def generate(
        self,
        project_path: Path,
        config: GenerationConfig,
        resume_from: int = 0,
        existing_qa: Optional[List[Dict[str, Any]]] = None,
    ):
        error_log = project_path / "error.log"
        # Clear any previous generation errors so old messages don't persist
        if error_log.exists():
            error_log.unlink()
        # Clear previous progress only when starting fresh (not resuming)
        # so the resume_from offset in progress.json stays readable until
        # run_pipeline_task has already extracted it.
        if resume_from == 0:
            progress_path = project_path / "progress.json"
            if progress_path.exists():
                progress_path.unlink()

        # 1. Load Chunks
        chunks_path = project_path / "chunks.json"
        if not chunks_path.exists():
            self._write_error(
                project_path,
                "[Generation] chunks.json not found — chunking stage may have failed.",
            )
            return []

        try:
            with open(chunks_path, "r", encoding="utf-8") as f:
                chunks = json.load(f)
        except Exception as e:
            self._write_error(
                project_path, f"[Generation] Failed to load chunks.json: {e}"
            )
            return []

        if not chunks:
            self._write_error(
                project_path,
                "[Generation] chunks.json is empty — nothing to generate from.",
            )
            return []

        # 2. Load Prompt Template
        prompt_path = Path(__file__).parent.parent / "prompts" / "base_prompt.txt"
        with open(prompt_path, "r", encoding="utf-8") as f:
            base_prompt = f.read()

        # 3. Initialize LLM
        llm = self._get_provider(config)

        # Seed with existing partial results when resuming
        qa_results = list(existing_qa) if existing_qa else []
        chunk_errors = []
        total = len(chunks)

        # Skip already-processed chunks when resuming
        chunks_to_process = chunks[resume_from:] if resume_from > 0 else chunks
        if resume_from > 0:
            logger.info(
                f"[Generation] Resuming from chunk {resume_from}/{total}, {len(qa_results)} existing QA pairs loaded."
            )

        # Initialize / update qa_v1.json with whatever we already have
        qa_path = project_path / "qa_v1.json"
        self._atomic_write_json(qa_path, qa_results)

        self._write_progress(project_path, resume_from, total, "starting")

        # 4. Loop through chunks (offset index when resuming)
        for i, chunk in enumerate(chunks_to_process, start=resume_from):
            # Check for stop signal
            if (project_path / ".stop").exists():
                logger.info(
                    f"[Generation] Stop signal detected for {project_path.name}"
                )
                # Save partial results if any
                if qa_results:
                    partial_path = project_path / "qa_partial.json"
                    self._atomic_write_json(partial_path, qa_results)

                # Clean up lock files
                if (project_path / ".running").exists():
                    (project_path / ".running").unlink()
                (project_path / ".stop").unlink()

                self._write_progress(project_path, i, total, "stopped")
                return qa_results

            text = chunk["text"]

            token_count = chunk.get("token_count", len(text))

            # QA Count: density_factor per 300 tokens (default 1.0 = 1 pair per 300 tokens)
            qa_count = max(1, int((token_count / 300) * config.qa_density_factor))

            # Formulate Prompt
            prompt = base_prompt.format(
                domain=config.domain, qa_count=qa_count, chunk=text
            )

            # Pydantic v2 uses model_dump(), v1 uses dict()
            try:
                llm_config = config.model_dump()
            except AttributeError:
                llm_config = config.dict()

            self._write_progress(
                project_path, i, total, f"generating chunk {i+1}/{total}"
            )

            # Call LLM
            try:
                response_text = llm.generate(prompt, llm_config)
            except Exception as e:
                err = f"[Generation] LLM call failed for chunk {chunk['chunk_id']}: {e}"
                chunk_errors.append(err)
                logger.error(err)
                # If first chunk fails, abort early — no point calling hundreds more times
                if i == 0:
                    self._write_error(
                        project_path,
                        f"[Generation] Aborting: LLM provider unreachable on first chunk.\n"
                        f"Provider: {config.provider}, Model: {config.model_name}\n"
                        f"Error: {e}\n\n"
                        f"If using Ollama, make sure 'ollama serve' is running and the model is pulled.\n"
                        f"If using OpenAI, check that your API key is set in Settings.",
                    )
                    self._write_progress(project_path, 0, total, "error")
                    return []
                continue

            # Parse JSON from response
            try:
                qas = None
                # First, try to parse the whole response naked
                try:
                    qas = json.loads(response_text.strip())
                except json.JSONDecodeError:
                    # Fallback: robust extraction of a JSON array containing objects
                    json_match = re.search(
                        r"\[\s*\{.*\}\s*\]", response_text, re.DOTALL
                    )
                    if json_match:
                        try:
                            qas = json.loads(json_match.group(0))
                        except json.JSONDecodeError as e:
                            err = f"[Generation] Nested JSON parse error for chunk {chunk['chunk_id']}: {e}"
                            chunk_errors.append(err)
                            logger.warning(err)
                    else:
                        err = f"[Generation] No JSON array found in LLM response for chunk {chunk['chunk_id']}. Response: {response_text[:200]}"
                        chunk_errors.append(err)
                        logger.warning(err)

                if qas is not None:
                    if isinstance(qas, list):
                        for qa in qas:
                            qa["chunk_id"] = chunk["chunk_id"]
                            qa_results.append(qa)
                        # ── Incremental save after every successful chunk ──
                        self._atomic_write_json(qa_path, qa_results)
                    else:
                        err = f"[Generation] Unexpected JSON type for chunk {chunk['chunk_id']}: got {type(qas).__name__}"
                        chunk_errors.append(err)
                        logger.warning(err)
            except Exception as e:
                err = f"[Generation] Unexpected extraction error for chunk {chunk['chunk_id']}: {e}"
                chunk_errors.append(err)
                logger.warning(err)

        # 5. Final save (covers edge case where last chunk had no new QAs)
        self._atomic_write_json(qa_path, qa_results)

        # Clean up any stale .stop file if generation finished normally
        stop_path = project_path / ".stop"
        if stop_path.exists():
            stop_path.unlink()

        # ── Clean up the partial file after a successful run ────────────────
        # (either a fresh run that completed, or a resumed run that finished)
        # Without this, has_partial stays true and the resume modal keeps
        # appearing even after everything completed successfully.
        partial_path = project_path / "qa_partial.json"
        if partial_path.exists():
            partial_path.unlink()

        self._write_progress(project_path, total, total, "done")

        # 6. Write a summary error if we got zero results
        if not qa_results:
            error_summary = (
                f"[Generation] Completed with 0 QA pairs generated from {len(chunks)} chunks.\n"
                f"Chunk errors ({len(chunk_errors)}):\n"
                + "\n".join(chunk_errors[:10])  # first 10 errors only
            )
            self._write_error(project_path, error_summary)
        elif chunk_errors:
            logger.warning(
                f"[Generation] {len(chunk_errors)} chunk(s) failed, {len(qa_results)} QA pairs saved."
            )

        return qa_results


generation_engine = GenerationEngine()
