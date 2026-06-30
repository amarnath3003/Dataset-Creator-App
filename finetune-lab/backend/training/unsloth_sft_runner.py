from __future__ import annotations

import gc
import json
import logging
import math
import os
import time
import traceback
from dataclasses import asdict
from pathlib import Path
from typing import Any, Optional, Protocol

import torch
from datasets import Dataset, load_dataset
from trl import SFTConfig, SFTTrainer
from transformers import TrainerCallback, TrainerControl, TrainerState, TrainingArguments
from unsloth import FastLanguageModel

from training.sft_config import SFTTrainingConfig, TrainingRunResult

logger = logging.getLogger(__name__)


# -----------------------------
# Event sink interface
# -----------------------------
class EventSink(Protocol):
    def emit(self, event: dict[str, Any]) -> None: ...


# -----------------------------
# Logging callback
# -----------------------------
class StreamingMetricsCallback(TrainerCallback):
    """
    Streams live metrics from Hugging Face / TRL training loop.

    Use `on_log` for metrics, `on_step_end` for step boundary telemetry,
    and `on_train_begin` / `on_train_end` for lifecycle events.
    """

    def __init__(self, sink: EventSink, run_id: str):
        self.sink = sink
        self.run_id = run_id
        self.start_time: Optional[float] = None

    def _eta_seconds(self, state: TrainerState) -> int:
        if not self.start_time or not state.global_step or not state.max_steps:
            return 0
        elapsed = time.time() - self.start_time
        per_step = elapsed / max(state.global_step, 1)
        remaining = max(state.max_steps - state.global_step, 0)
        return int(round(per_step * remaining))

    def _gpu_snapshot(self) -> dict[str, Any]:
        if not torch.cuda.is_available():
            return {"cuda": False}

        device = torch.cuda.current_device()
        allocated = torch.cuda.memory_allocated(device)
        reserved = torch.cuda.memory_reserved(device)
        max_allocated = torch.cuda.max_memory_allocated(device)
        max_reserved = torch.cuda.max_memory_reserved(device)

        return {
            "cuda": True,
            "device": device,
            "allocated_mb": round(allocated / 1024 / 1024, 2),
            "reserved_mb": round(reserved / 1024 / 1024, 2),
            "max_allocated_mb": round(max_allocated / 1024 / 1024, 2),
            "max_reserved_mb": round(max_reserved / 1024 / 1024, 2),
        }

    def on_train_begin(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs,
    ):
        self.start_time = time.time()
        self.sink.emit(
            {
                "type": "train_begin",
                "run_id": self.run_id,
                "global_step": state.global_step,
                "epoch": state.epoch,
                "total_steps": state.max_steps,
                "max_steps": state.max_steps,
                "gpu": self._gpu_snapshot(),
            }
        )

    def on_log(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        logs: Optional[dict[str, float]] = None,
        **kwargs,
    ):
        payload: dict[str, Any] = {
            "type": "metrics",
            "run_id": self.run_id,
            "global_step": state.global_step,
            "epoch": state.epoch,
            "step": state.global_step,
            "max_steps": state.max_steps,
            "total_steps": state.max_steps,
            "eta_seconds": self._eta_seconds(state),
            "gpu": self._gpu_snapshot(),
        }
        if logs:
            for k, v in logs.items():
                if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                    payload[k] = float(v)
                else:
                    payload[k] = v

        self.sink.emit(payload)

    def on_step_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs,
    ):
        self.sink.emit(
            {
                "type": "step_end",
                "run_id": self.run_id,
                "global_step": state.global_step,
                "epoch": state.epoch,
                "max_steps": state.max_steps,
                "total_steps": state.max_steps,
                "gpu": self._gpu_snapshot(),
            }
        )

    def on_save(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs,
    ):
        self.sink.emit(
            {
                "type": "checkpoint_saved",
                "run_id": self.run_id,
                "global_step": state.global_step,
                "epoch": state.epoch,
                "checkpoint_dir": args.output_dir,
            }
        )

    def on_train_end(
        self,
        args: TrainingArguments,
        state: TrainerState,
        control: TrainerControl,
        **kwargs,
    ):
        self.sink.emit(
            {
                "type": "train_end",
                "run_id": self.run_id,
                "global_step": state.global_step,
                "epoch": state.epoch,
                "gpu": self._gpu_snapshot(),
            }
        )


# -----------------------------
# Core runner
# -----------------------------
class UnslothSFTRunner:
    def __init__(self, cfg: SFTTrainingConfig, sink: EventSink):
        self.cfg = cfg
        self.sink = sink
        self.output_dir = Path(cfg.output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self._latest_model = None
        self._latest_tokenizer = None

    def run(self) -> TrainingRunResult:
        """
        Main entrypoint for a GPU worker.
        """
        self._emit({"type": "job_started", "run_id": self.cfg.run_id, "config": asdict(self.cfg)})

        attempt_cfg = self.cfg
        last_exc: Optional[BaseException] = None

        for attempt in range(self.cfg.max_oom_retries + 1):
            try:
                return self._run_once(attempt_cfg, attempt)
            except torch.cuda.OutOfMemoryError as e:
                last_exc = e
                self._emit(
                    {
                        "type": "oom",
                        "run_id": self.cfg.run_id,
                        "attempt": attempt,
                        "message": str(e),
                    }
                )
                self._cleanup_cuda()

                if not attempt_cfg.retry_on_oom or attempt >= attempt_cfg.max_oom_retries:
                    return self._fail_result(
                        status="oom_failed",
                        exc=e,
                        extra_message="Training failed due to CUDA OOM after retries.",
                    )

                attempt_cfg = self._apply_oom_fallback(attempt_cfg, attempt)
                self._emit(
                    {
                        "type": "oom_retry",
                        "run_id": self.cfg.run_id,
                        "attempt": attempt + 1,
                        "adjusted_config": {
                            "max_seq_length": attempt_cfg.max_seq_length,
                            "per_device_train_batch_size": attempt_cfg.per_device_train_batch_size,
                            "gradient_accumulation_steps": attempt_cfg.gradient_accumulation_steps,
                            "use_gradient_checkpointing": attempt_cfg.use_gradient_checkpointing,
                        },
                    }
                )
                continue
            except RuntimeError as e:
                last_exc = e
                if "out of memory" in str(e).lower() or "cuda error: out of memory" in str(e).lower():
                    self._cleanup_cuda()
                    if not attempt_cfg.retry_on_oom or attempt >= attempt_cfg.max_oom_retries:
                        return self._fail_result(
                            status="oom_failed",
                            exc=e,
                            extra_message="Training failed due to CUDA OOM after retries.",
                        )
                    attempt_cfg = self._apply_oom_fallback(attempt_cfg, attempt)
                    self._emit(
                        {
                            "type": "oom_retry",
                            "run_id": self.cfg.run_id,
                            "attempt": attempt + 1,
                            "adjusted_config": {
                                "max_seq_length": attempt_cfg.max_seq_length,
                                "per_device_train_batch_size": attempt_cfg.per_device_train_batch_size,
                                "gradient_accumulation_steps": attempt_cfg.gradient_accumulation_steps,
                                "use_gradient_checkpointing": attempt_cfg.use_gradient_checkpointing,
                            },
                        }
                    )
                    continue
                return self._fail_result(status="failed", exc=e)
            except Exception as e:
                last_exc = e
                return self._fail_result(status="failed", exc=e)

        return self._fail_result(
            status="failed",
            exc=last_exc or RuntimeError("Unknown failure"),
            extra_message="Training failed unexpectedly.",
        )

    def _run_once(self, cfg: SFTTrainingConfig, attempt: int) -> TrainingRunResult:
        self._emit({"type": "attempt_start", "run_id": cfg.run_id, "attempt": attempt})

        model, tokenizer = self._load_model(cfg)
        train_dataset = self._prepare_dataset(cfg, tokenizer)

        trainer = self._build_trainer(cfg, model, tokenizer, train_dataset)

        self._latest_model = model
        self._latest_tokenizer = tokenizer

        resume_path = cfg.resume_from_checkpoint
        if resume_path:
            self._emit(
                {
                    "type": "resume",
                    "run_id": cfg.run_id,
                    "resume_from_checkpoint": resume_path,
                }
            )

        train_output = trainer.train(resume_from_checkpoint=resume_path)
        metrics = self._normalize_metrics(train_output.metrics if hasattr(train_output, "metrics") else {})

        # Save adapter / model + tokenizer
        final_dir = self._save_artifacts(trainer, tokenizer, cfg)

        # Push to hub if requested
        if cfg.push_to_hub:
            self._push_to_hub_if_enabled(trainer, cfg)

        self._write_run_manifest(cfg, metrics, final_dir)

        self._emit(
            {
                "type": "job_succeeded",
                "run_id": cfg.run_id,
                "metrics": metrics,
                "final_checkpoint": str(final_dir),
            }
        )

        return TrainingRunResult(
            run_id=cfg.run_id,
            status="succeeded",
            output_dir=str(self.output_dir),
            metrics=metrics,
            final_checkpoint=str(final_dir),
        )

    def _load_model(self, cfg: SFTTrainingConfig):
        dtype = self._resolve_dtype(cfg.dtype)

        self._emit(
            {
                "type": "model_loading",
                "run_id": cfg.run_id,
                "model_name": cfg.model_name,
                "max_seq_length": cfg.max_seq_length,
                "load_in_4bit": cfg.load_in_4bit,
                "dtype": str(dtype),
            }
        )

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=cfg.model_name,
            max_seq_length=cfg.max_seq_length,
            dtype=dtype,
            load_in_4bit=cfg.load_in_4bit,
            token=cfg.hf_token,
            trust_remote_code=cfg.trust_remote_code,
        )

        # CPT also tunes the input/output embeddings so the model can adapt to a new
        # domain's vocabulary; add them to the LoRA target modules.
        target_modules = list(cfg.target_modules)
        if cfg.train_embeddings:
            for extra in ("embed_tokens", "lm_head"):
                if extra not in target_modules:
                    target_modules.append(extra)

        peft_kwargs: dict[str, Any] = dict(
            r=cfg.lora_rank,
            target_modules=target_modules,
            lora_alpha=cfg.lora_alpha,
            lora_dropout=cfg.lora_dropout,
            bias=cfg.bias,
            use_gradient_checkpointing=cfg.use_gradient_checkpointing,
            random_state=cfg.seed,
            use_rslora=cfg.use_rslora,
        )

        # LoftQ improves QLoRA accuracy but only applies to 4-bit bases and can be
        # finicky; enable it best-effort and fall back to standard init on failure.
        loftq_enabled = False
        if cfg.use_loftq and cfg.load_in_4bit:
            try:
                from peft import LoftQConfig

                peft_kwargs["loftq_config"] = LoftQConfig(loftq_bits=4, loftq_iter=1)
                peft_kwargs["init_lora_weights"] = "loftq"
                loftq_enabled = True
            except Exception as exc:  # noqa: BLE001
                self._emit({"type": "warning", "run_id": cfg.run_id,
                            "message": f"LoftQ unavailable, using standard LoRA init: {exc}"})

        try:
            model = FastLanguageModel.get_peft_model(model, **peft_kwargs)
        except Exception as exc:  # noqa: BLE001
            if loftq_enabled:
                self._emit({"type": "warning", "run_id": cfg.run_id,
                            "message": f"LoftQ init failed ({exc}); retrying with standard LoRA init."})
                peft_kwargs.pop("loftq_config", None)
                peft_kwargs.pop("init_lora_weights", None)
                loftq_enabled = False
                model = FastLanguageModel.get_peft_model(model, **peft_kwargs)
            else:
                raise

        self._emit({
            "type": "peft_configured",
            "run_id": cfg.run_id,
            "lora_rank": cfg.lora_rank,
            "lora_alpha": cfg.lora_alpha,
            "lora_dropout": cfg.lora_dropout,
            "use_rslora": cfg.use_rslora,
            "loftq": loftq_enabled,
            "load_in_4bit": cfg.load_in_4bit,
            "train_embeddings": cfg.train_embeddings,
        })

        return model, tokenizer

    def _prepare_dataset(self, cfg: SFTTrainingConfig, tokenizer) -> Dataset:
        ds = self._load_dataset_any(cfg.dataset_source)
        self._emit(
            {
                "type": "dataset_loaded",
                "run_id": cfg.run_id,
                "rows": len(ds),
                "columns": list(ds.column_names),
            }
        )

        eos = (getattr(tokenizer, "eos_token", "") or "") if cfg.append_eos else ""

        if cfg.dataset_text_field in ds.column_names:
            # Already raw text. For CPT, append EOS so documents are separated.
            if eos:
                field_name = cfg.dataset_text_field
                ds = ds.map(
                    lambda ex: {field_name: (ex[field_name] or "") + eos},
                    desc="Appending EOS",
                )
            return ds

        def format_example(example: dict[str, Any]) -> dict[str, str]:
            text = self._example_to_text(example, tokenizer, cfg)
            if eos and text:
                text = text + eos
            return {cfg.dataset_text_field: text}

        formatted = ds.map(format_example, remove_columns=ds.column_names, desc="Formatting dataset")
        formatted = formatted.filter(lambda x: bool(x[cfg.dataset_text_field].strip()))

        self._emit(
            {
                "type": "dataset_formatted",
                "run_id": cfg.run_id,
                "rows": len(formatted),
                "field": cfg.dataset_text_field,
            }
        )
        return formatted

    def _build_trainer(
        self,
        cfg: SFTTrainingConfig,
        model,
        tokenizer,
        train_dataset: Dataset,
    ) -> SFTTrainer:
        # Choose precision from the actual GPU: bf16 on Ampere+, else fp16.
        bf16 = bool(torch.cuda.is_available() and torch.cuda.is_bf16_supported())
        fp16 = bool(torch.cuda.is_available() and not bf16)

        common_kwargs: dict[str, Any] = dict(
            output_dir=str(self.output_dir),
            num_train_epochs=cfg.num_train_epochs,
            max_steps=cfg.max_steps,
            per_device_train_batch_size=cfg.per_device_train_batch_size,
            gradient_accumulation_steps=cfg.gradient_accumulation_steps,
            learning_rate=cfg.learning_rate,
            warmup_ratio=cfg.warmup_ratio,
            weight_decay=cfg.weight_decay,
            lr_scheduler_type=cfg.lr_scheduler_type,
            optim=cfg.optim,
            seed=cfg.seed,
            bf16=bf16,
            fp16=fp16,
            logging_steps=cfg.logging_steps,
            save_strategy=cfg.save_strategy,
            save_steps=cfg.save_steps,
            save_total_limit=cfg.save_total_limit,
            report_to=cfg.report_to,
            remove_unused_columns=False,
            gradient_checkpointing=cfg.use_gradient_checkpointing,
            gradient_checkpointing_kwargs={"use_reentrant": False},
        )

        # TRL moved these onto SFTConfig in newer releases; on older builds they
        # belong on the SFTTrainer constructor instead. Try config-first, fall back.
        sft_only = dict(
            packing=cfg.packing,
            max_seq_length=cfg.max_seq_length,
            dataset_text_field=cfg.dataset_text_field,
        )
        try:
            sft_config = SFTConfig(**common_kwargs, **sft_only)
            trainer_extra: dict[str, Any] = {}
        except TypeError:
            sft_config = SFTConfig(**common_kwargs)
            trainer_extra = dict(sft_only)

        callback = StreamingMetricsCallback(self.sink, cfg.run_id)

        # Newer TRL uses `processing_class`; older uses `tokenizer`.
        try:
            trainer = SFTTrainer(
                model=model,
                train_dataset=train_dataset,
                args=sft_config,
                callbacks=[callback],
                processing_class=tokenizer,
                **trainer_extra,
            )
        except TypeError:
            trainer = SFTTrainer(
                model=model,
                tokenizer=tokenizer,
                train_dataset=train_dataset,
                args=sft_config,
                callbacks=[callback],
                **trainer_extra,
            )

        return trainer

    def _save_artifacts(self, trainer: SFTTrainer, tokenizer, cfg: SFTTrainingConfig) -> Path:
        final_dir = self.output_dir / "final"
        final_dir.mkdir(parents=True, exist_ok=True)

        self._emit(
            {
                "type": "saving",
                "run_id": cfg.run_id,
                "path": str(final_dir),
            }
        )

        # Save tokenizer
        tokenizer.save_pretrained(str(final_dir))

        # Save model/adapter safely
        model = trainer.model
        if hasattr(model, "save_pretrained"):
            model.save_pretrained(str(final_dir))
        else:
            trainer.save_model(str(final_dir))

        # Save trainer state if available
        try:
            trainer.save_state()
        except Exception:
            pass

        return final_dir

    def _push_to_hub_if_enabled(self, trainer: SFTTrainer, cfg: SFTTrainingConfig) -> None:
        if not cfg.hub_model_id:
            raise ValueError("push_to_hub=True requires hub_model_id.")

        self._emit(
            {
                "type": "push_to_hub",
                "run_id": cfg.run_id,
                "hub_model_id": cfg.hub_model_id,
            }
        )

        # Trainer / model may already be hub-aware through SFTConfig.
        # If you need a stronger guarantee, call trainer.push_to_hub() here.
        if hasattr(trainer, "push_to_hub"):
            trainer.push_to_hub()

    def _load_dataset_any(self, source: Any) -> Dataset:
        if isinstance(source, Dataset):
            return source

        if isinstance(source, list):
            return Dataset.from_list(source)

        if isinstance(source, dict):
            # dict of columns -> values
            return Dataset.from_dict(source)

        if isinstance(source, str):
            path = Path(source)
            if path.exists():
                suffix = path.suffix.lower()
                if suffix in {".json", ".jsonl"}:
                    return load_dataset("json", data_files=str(path), split="train")
                if suffix in {".csv"}:
                    return load_dataset("csv", data_files=str(path), split="train")
                if suffix in {".parquet"}:
                    return load_dataset("parquet", data_files=str(path), split="train")
                raise ValueError(f"Unsupported local dataset file type: {suffix}")

            # Otherwise assume a Hugging Face dataset id.
            return load_dataset(source, split="train")

        raise TypeError(f"Unsupported dataset_source type: {type(source)!r}")

    def _example_to_text(self, example: dict[str, Any], tokenizer, cfg: SFTTrainingConfig) -> str:
        # 1) Plain text corpus
        if "text" in example and isinstance(example["text"], str):
            return example["text"]

        # 2) Instruction tuning schema
        if "instruction" in example and "output" in example:
            instruction = str(example.get("instruction", "")).strip()
            inp = str(example.get("input", "")).strip()
            output = str(example.get("output", "")).strip()

            prompt = instruction if not inp else f"{instruction}\n\nInput:\n{inp}"
            return f"### Instruction:\n{prompt}\n\n### Response:\n{output}"

        # 3) Chat schema
        if "messages" in example and isinstance(example["messages"], list):
            messages = example["messages"]
            if hasattr(tokenizer, "apply_chat_template"):
                try:
                    return tokenizer.apply_chat_template(
                        messages,
                        tokenize=False,
                        add_generation_prompt=False,
                    )
                except Exception:
                    pass

            # Fallback rendering
            parts: list[str] = []
            for msg in messages:
                role = str(msg.get("role", "user")).strip()
                content = str(msg.get("content", "")).strip()
                parts.append(f"{role.upper()}: {content}")
            return "\n".join(parts)

        # 4) ShareGPT-ish schema
        if "conversations" in example and isinstance(example["conversations"], list):
            parts: list[str] = []
            for turn in example["conversations"]:
                role = str(turn.get("from", turn.get("role", "user"))).strip()
                content = str(turn.get("value", turn.get("content", ""))).strip()
                parts.append(f"{role.upper()}: {content}")
            return "\n".join(parts)

        # 5) Preference schema is not SFT; preserve as text only if possible
        if "prompt" in example and "completion" in example:
            return f"### Prompt:\n{example['prompt']}\n\n### Response:\n{example['completion']}"

        # Last resort
        return json.dumps(example, ensure_ascii=False)

    def _resolve_dtype(self, dtype: Optional[str]):
        if dtype is None or str(dtype).lower() == "auto":
            return None
        dtype = str(dtype).lower()
        if dtype in {"bf16", "bfloat16"}:
            return torch.bfloat16
        if dtype in {"fp16", "float16", "half"}:
            return torch.float16
        if dtype in {"fp32", "float32"}:
            return torch.float32
        return None

    def _apply_oom_fallback(
        self, cfg: SFTTrainingConfig, attempt: int
    ) -> SFTTrainingConfig:
        """
        Best-effort fallback strategy for OOM:
        - cut sequence length
        - reduce micro-batch
        - increase grad accumulation
        - force checkpointing
        """
        new_cfg = SFTTrainingConfig(**asdict(cfg))

        # Reduce sequence length aggressively but never below 512.
        new_cfg.max_seq_length = max(512, int(new_cfg.max_seq_length * 0.75))
        if attempt >= 1:
            new_cfg.max_seq_length = max(512, int(new_cfg.max_seq_length * 0.75))

        # Make micro-batch smaller
        if new_cfg.per_device_train_batch_size > 1:
            new_cfg.per_device_train_batch_size = 1
            new_cfg.gradient_accumulation_steps = max(
                new_cfg.gradient_accumulation_steps * 2, 8
            )
        else:
            new_cfg.gradient_accumulation_steps = max(
                new_cfg.gradient_accumulation_steps * 2, 8
            )

        new_cfg.use_gradient_checkpointing = True
        new_cfg.load_in_4bit = True
        new_cfg.packing = False

        # Safer save/eval settings
        new_cfg.evaluation_strategy = "no"
        new_cfg.eval_steps = None

        return new_cfg

    def _cleanup_cuda(self) -> None:
        try:
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                torch.cuda.ipc_collect()
        except Exception:
            pass
        gc.collect()

    def _normalize_metrics(self, metrics: dict[str, Any]) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, v in metrics.items():
            if isinstance(v, (int, float)) and not (isinstance(v, float) and math.isnan(v)):
                out[k] = float(v)
            else:
                out[k] = v
        return out

    def _write_run_manifest(
        self,
        cfg: SFTTrainingConfig,
        metrics: dict[str, Any],
        final_dir: Path,
    ) -> None:
        manifest = {
            "run_id": cfg.run_id,
            "model_name": cfg.model_name,
            "config": asdict(cfg),
            "metrics": metrics,
            "final_dir": str(final_dir),
        }
        (self.output_dir / "run_manifest.json").write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False)
        )

    def _emit(self, event: dict[str, Any]) -> None:
        try:
            self.sink.emit(event)
        except Exception:
            logger.exception("Failed to emit event: %s", event)

    def _fail_result(
        self,
        status: Literal["failed", "oom_failed"],
        exc: BaseException,
        extra_message: Optional[str] = None,
    ) -> TrainingRunResult:
        tb = traceback.format_exc()
        self._emit(
            {
                "type": "job_failed",
                "run_id": self.cfg.run_id,
                "status": status,
                "error": str(exc),
                "traceback": tb,
                "message": extra_message,
            }
        )
        return TrainingRunResult(
            run_id=self.cfg.run_id,
            status=status,
            output_dir=str(self.output_dir),
            error=str(exc),
            traceback=tb,
        )


# -----------------------------
# Simple sink implementations
# -----------------------------
class PrintSink:
    def emit(self, event: dict[str, Any]) -> None:
        print(json.dumps(event, ensure_ascii=False, default=str))
