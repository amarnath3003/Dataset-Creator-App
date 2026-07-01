"""Vision (VLM) fine-tuning runner.

Subclasses the text runner so it reuses the whole execution shell — OOM retry,
streaming callback, artifact saving, run manifest, rank-gated telemetry — and
overrides only what is genuinely different for multimodal models:

  * model loading via ``FastVisionModel`` (+ vision-aware LoRA flags),
  * image+text dataset formatting into chat ``messages``,
  * an image-aware data collator (``UnslothVisionDataCollator``).

The ``tokenizer`` slot here actually holds an ``AutoProcessor`` (text + image),
which is what the collator and ``save_pretrained`` expect.
"""
from __future__ import annotations

from typing import Any

# Unsloth must be imported before torch/trl/transformers (see the note in
# unsloth_sft_runner.py). The base-runner import below already pulls Unsloth in
# first, but keep the explicit unsloth import ahead of torch/trl here too so this
# module is order-safe on its own.
import unsloth  # noqa: F401  (side-effecting: must run before torch/trl/transformers)
from unsloth import FastVisionModel

import torch
from trl import SFTConfig, SFTTrainer

from training.unsloth_sft_runner import StreamingMetricsCallback, UnslothSFTRunner


def _import_vision_collator():
    """UnslothVisionDataCollator moved across versions — try known locations."""
    try:
        from unsloth import UnslothVisionDataCollator  # newer
        return UnslothVisionDataCollator
    except Exception:
        from unsloth.trainer import UnslothVisionDataCollator  # older
        return UnslothVisionDataCollator


class UnslothVisionRunner(UnslothSFTRunner):
    # ------------------------------------------------------------------ model
    def _load_model(self, cfg):
        self._emit({
            "type": "model_loading",
            "run_id": cfg.run_id,
            "model_name": cfg.model_name,
            "max_seq_length": cfg.max_seq_length,
            "load_in_4bit": cfg.load_in_4bit,
            "dtype": "vision",
        })

        model, processor = FastVisionModel.from_pretrained(
            cfg.model_name,
            load_in_4bit=cfg.load_in_4bit,
            use_gradient_checkpointing="unsloth",
            token=cfg.hf_token,
        )

        model = FastVisionModel.get_peft_model(
            model,
            finetune_vision_layers=cfg.finetune_vision_layers,
            finetune_language_layers=cfg.finetune_language_layers,
            finetune_attention_modules=cfg.finetune_attention_modules,
            finetune_mlp_modules=cfg.finetune_mlp_modules,
            r=cfg.lora_rank,
            lora_alpha=cfg.lora_alpha,
            lora_dropout=cfg.lora_dropout,
            bias=cfg.bias,
            random_state=cfg.seed,
            use_rslora=cfg.use_rslora,
        )

        self._emit({
            "type": "peft_configured",
            "run_id": cfg.run_id,
            "lora_rank": cfg.lora_rank,
            "lora_alpha": cfg.lora_alpha,
            "lora_dropout": cfg.lora_dropout,
            "use_rslora": cfg.use_rslora,
            "loftq": False,
            "load_in_4bit": cfg.load_in_4bit,
            "vision": True,
        })

        return model, processor

    # ---------------------------------------------------------------- dataset
    def _prepare_dataset(self, cfg, processor):
        ds = self._load_dataset_any(cfg.dataset_source)
        columns = list(getattr(ds, "column_names", []) or [])
        self._emit({"type": "dataset_loaded", "run_id": cfg.run_id,
                    "rows": len(ds), "columns": columns})

        # Already in chat format → use directly.
        if "messages" in columns:
            self._emit({"type": "dataset_formatted", "run_id": cfg.run_id,
                        "rows": len(ds), "field": "messages"})
            return ds

        image_col = self._detect_image_column(ds)
        text_col = self._detect_text_column(ds, exclude=image_col)
        if image_col is None or text_col is None:
            raise ValueError(
                "Vision datasets need an image column and a text/answer column "
                "(or a pre-formatted 'messages' column). "
                f"Found columns: {columns}"
            )

        instruction = cfg.vision_instruction

        def convert(sample: dict[str, Any]) -> dict[str, Any]:
            return {
                "messages": [
                    {"role": "user", "content": [
                        {"type": "text", "text": instruction},
                        {"type": "image", "image": sample[image_col]},
                    ]},
                    {"role": "assistant", "content": [
                        {"type": "text", "text": str(sample[text_col])},
                    ]},
                ]
            }

        converted = [convert(s) for s in ds]
        self._emit({"type": "dataset_formatted", "run_id": cfg.run_id,
                    "rows": len(converted), "field": "messages",
                    "image_column": image_col, "text_column": text_col})
        return converted

    def _detect_image_column(self, ds):
        # Prefer a real datasets.Image feature.
        try:
            from datasets import Image as HFImage

            for name, feat in (getattr(ds, "features", {}) or {}).items():
                if isinstance(feat, HFImage):
                    return name
        except Exception:
            pass
        for cand in ("image", "images", "img", "picture", "pixel_values"):
            if cand in getattr(ds, "column_names", []):
                return cand
        return None

    def _detect_text_column(self, ds, exclude):
        cols = list(getattr(ds, "column_names", []) or [])
        for cand in ("text", "caption", "answer", "output", "label",
                     "solution", "description", "response", "target"):
            if cand in cols and cand != exclude:
                return cand
        for name in cols:  # fallback: any non-image column
            if name != exclude:
                return name
        return None

    # ---------------------------------------------------------------- trainer
    def _build_trainer(self, cfg, model, tokenizer, train_dataset):
        # Put the model into training mode for vision.
        try:
            FastVisionModel.for_training(model)
        except Exception:
            pass

        collator = _import_vision_collator()(model, tokenizer)

        bf16 = bool(torch.cuda.is_available() and torch.cuda.is_bf16_supported())
        fp16 = bool(torch.cuda.is_available() and not bf16)

        common = dict(
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
            gradient_checkpointing=cfg.use_gradient_checkpointing,
        )
        # Vision SFT requires these; older TRL may not accept all of them.
        vision_only = dict(
            remove_unused_columns=False,
            dataset_text_field="",
            dataset_kwargs={"skip_prepare_dataset": True},
            max_seq_length=cfg.max_seq_length,
        )
        try:
            sft_config = SFTConfig(**common, **vision_only)
        except TypeError:
            sft_config = SFTConfig(**common, remove_unused_columns=False)

        callback = StreamingMetricsCallback(self.sink, cfg.run_id)

        trainer_kwargs = dict(
            model=model,
            data_collator=collator,
            train_dataset=train_dataset,
            args=sft_config,
            callbacks=[callback],
        )
        try:
            trainer = SFTTrainer(processing_class=tokenizer, **trainer_kwargs)
        except TypeError:
            trainer = SFTTrainer(tokenizer=tokenizer, **trainer_kwargs)

        return trainer
