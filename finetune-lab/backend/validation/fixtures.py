"""Tiny synthetic fixtures for GPU validation.

Kept torch-free: only writes small JSONL files to disk. Vision uses a small
Hugging Face dataset id instead (image data can't be synthesised into JSONL).
"""
from __future__ import annotations

import json
from pathlib import Path

from config import STORAGE_DIR

VALIDATION_DIR = STORAGE_DIR / "validation"
FIXTURES_DIR = VALIDATION_DIR / "fixtures"


# A handful of instruction rows — enough to feed a few training steps. Uses the
# instruction/input/output schema that UnslothSFTRunner._example_to_text handles.
_INSTRUCTION_ROWS = [
    {"instruction": "What is the capital of France?", "input": "", "output": "The capital of France is Paris."},
    {"instruction": "Add the two numbers.", "input": "2 and 3", "output": "5"},
    {"instruction": "Translate to French.", "input": "hello", "output": "bonjour"},
    {"instruction": "Give the opposite of a word.", "input": "hot", "output": "cold"},
    {"instruction": "Name a primary color.", "input": "", "output": "Red is a primary color."},
    {"instruction": "What sound does a cat make?", "input": "", "output": "A cat says meow."},
    {"instruction": "Spell the word.", "input": "dog", "output": "d-o-g"},
    {"instruction": "Complete the sentence.", "input": "The sky is", "output": "The sky is blue."},
]

# Raw-text corpus for CPT (continued pre-training). The runner appends EOS.
_TEXT_ROWS = [
    {"text": "Finetune Lab turns a JSONL dataset into a trained model on a local GPU."},
    {"text": "Continued pre-training adapts a base model to a new domain corpus."},
    {"text": "Unsloth makes LoRA and QLoRA fine-tuning fast and memory efficient."},
    {"text": "The wizard walks the user through model, dataset, config, hardware and run."},
    {"text": "Gradient checkpointing trades compute for a lower peak VRAM footprint."},
    {"text": "A LoRA adapter is a small set of low-rank weight deltas over a frozen base."},
    {"text": "Quantisation to 4-bit shrinks the base model so it fits on smaller cards."},
    {"text": "Every finished run writes an adapter, tokenizer and a run manifest to disk."},
]


def _write_jsonl(path: Path, rows: list[dict]) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return path


def instruction_dataset(repeat: int = 4) -> str:
    """Small instruction-tuning JSONL (sft / lora / qlora / full). Returns a path."""
    rows = (_INSTRUCTION_ROWS * repeat)
    return str(_write_jsonl(FIXTURES_DIR / "instruction.jsonl", rows))


def text_corpus_dataset(repeat: int = 4) -> str:
    """Small raw-text JSONL for CPT. Returns a path."""
    rows = (_TEXT_ROWS * repeat)
    return str(_write_jsonl(FIXTURES_DIR / "corpus.jsonl", rows))
