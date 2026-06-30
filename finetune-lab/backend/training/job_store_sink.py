"""Event sink that projects the training runner's typed event stream into the
shared job store, so the frontend RunDashboard (polling ``/training/status``)
sees live status, progress, loss, VRAM, ETA and a rolling log tail.

The runner emits events shaped like ``{"type": ..., "run_id": ..., ...}``.
This sink is the single translator from that stream into a job record.
"""
from typing import Any

from job_engine import job_store

MAX_LOG_LINES = 500


class JobStoreSink:
    def __init__(self, run_id: str | None = None):
        self.run_id = run_id

    def emit(self, event: dict[str, Any]) -> None:
        run_id = event.get("run_id") or self.run_id
        if not run_id:
            return
        job_store.patch_job(run_id, lambda job: self._apply(job, event))

    # ------------------------------------------------------------------
    def _apply(self, job: dict, event: dict) -> None:
        etype = event.get("type")
        logs = job.setdefault("logs", [])

        def log(line: str) -> None:
            logs.append(line)
            overflow = len(logs) - MAX_LOG_LINES
            if overflow > 0:
                del logs[:overflow]

        def set_progress(step: int) -> None:
            job["step"] = step
            total = job.get("total_steps")
            if total:
                # Reserve 100% for the terminal success event.
                job["progress"] = min(99, int(step / total * 100))

        def set_vram(ev: dict) -> None:
            gpu = ev.get("gpu") or {}
            if gpu.get("max_allocated_mb"):
                job["vram_mb"] = gpu["max_allocated_mb"]
            elif ev.get("vram_mb"):
                job["vram_mb"] = ev["vram_mb"]

        if etype == "job_started":
            job["status"] = "running"
            log("> Job accepted. Booting training engine...")

        elif etype == "attempt_start":
            attempt = event.get("attempt", 0)
            if attempt > 0:
                log(f"> Retry attempt #{attempt} (post-OOM fallback)...")

        elif etype == "model_loading":
            job["status"] = "running"
            log(
                f"> Loading model '{event.get('model_name')}' "
                f"(4bit={event.get('load_in_4bit')}, seq={event.get('max_seq_length')})..."
            )

        elif etype == "dataset_loaded":
            log(f"> Dataset loaded: {event.get('rows')} rows | columns={event.get('columns')}")

        elif etype == "dataset_formatted":
            log(f"> Dataset formatted: {event.get('rows')} rows -> '{event.get('field')}'")

        elif etype == "train_begin":
            total = event.get("total_steps") or event.get("max_steps")
            if total and total > 0:
                job["total_steps"] = total
            set_vram(event)
            log(f"> Training started - {job.get('total_steps', '?')} total steps.")

        elif etype == "metrics":
            total = job.get("total_steps") or event.get("max_steps")
            if total and total > 0:
                job["total_steps"] = total
            if event.get("loss") is not None:
                job["loss"] = round(float(event["loss"]), 4)
            if event.get("learning_rate") is not None:
                job["learning_rate"] = event["learning_rate"]
            if event.get("epoch") is not None:
                job["epoch"] = round(float(event["epoch"]), 2)
            if event.get("eta_seconds") is not None:
                job["eta_seconds"] = event["eta_seconds"]
            set_vram(event)
            set_progress(event.get("global_step") or event.get("step") or job.get("step", 0))
            if event.get("loss") is not None:
                log(
                    f"  step {job.get('step')}/{job.get('total_steps', '?')}  "
                    f"loss={job['loss']}  lr={job.get('learning_rate')}"
                )

        elif etype == "step_end":
            set_vram(event)
            set_progress(event.get("global_step") or job.get("step", 0))

        elif etype == "checkpoint_saved":
            log(f"> Checkpoint saved at step {event.get('global_step')}.")

        elif etype == "saving":
            log(f"> Saving final artifacts -> {event.get('path')}...")

        elif etype == "oom":
            log(f"! CUDA out of memory (attempt {event.get('attempt')}). Cleaning up GPU...")

        elif etype == "oom_retry":
            log(f"! Auto-fallback to lighter settings: {event.get('adjusted_config')}")

        elif etype == "resume":
            log(f"> Resuming from checkpoint: {event.get('resume_from_checkpoint')}")

        elif etype == "push_to_hub":
            log(f"> Pushing to Hugging Face Hub: {event.get('hub_model_id')}")

        elif etype == "job_succeeded":
            job["status"] = "completed"
            job["progress"] = 100
            job["final_dir"] = event.get("final_checkpoint")
            job["metrics"] = event.get("metrics")
            job["eta_seconds"] = 0
            log("> [OK] Training complete. Adapter + tokenizer saved.")

        elif etype in ("job_failed", "oom_failed"):
            job["status"] = "failed"
            job["error"] = event.get("error", "Unknown error")
            log(f"! [FAILED] Training failed: {job['error']}")
