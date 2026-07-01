# GPU Validation Harness

End-to-end smoke tests for every training method. Proves that SFT / LoRA / QLoRA /
CPT / Full / Vision each **start, stream advancing loss + real progress, complete,
and write loadable artifacts** on an actual CUDA GPU.

It drives the **real production path** — `run_service.create_run` →
`run_service.dispatch` → `workers.gpu_worker.run_training_job` →
`UnslothSFTRunner` / `UnslothVisionRunner` — so a pass means the wiring the UI
uses actually works, not a parallel test-only path.

## Where to run

On a machine with a CUDA GPU and the ML stack installed
(`torch`, `unsloth`, `trl`, `peft`, `transformers`, `datasets`, `accelerate`,
`bitsandbytes`). Run from the **backend** directory:

```bash
cd finetune-lab/backend

# 1. Fast check: is the stack + GPU usable? (no training)
python -m validation.gpu_validate preflight

# 2. Validate all text methods (sft, lora, qlora, cpt, full) — tiny model, 4 steps each
python -m validation.gpu_validate run

# 3. Include vision (downloads a small VLM + image dataset)
python -m validation.gpu_validate run --all

# 4. A single method, more steps
python -m validation.gpu_validate run --methods full --steps 8

# 5. Multi-GPU DDP path (needs >=2 visible GPUs)
python -m validation.gpu_validate run --methods sft --gpus 2

# List methods + default models
python -m validation.gpu_validate list
```

## What each method uses

| Method | Base model (default)                       | Dataset                    | Notes |
|--------|--------------------------------------------|----------------------------|-------|
| sft    | `Qwen2.5-0.5B-Instruct-bnb-4bit` (4-bit)   | synthetic instruction JSONL| |
| lora   | same id → **16-bit** (worker strips `-bnb-4bit`) | instruction JSONL     | validates model-id resolution |
| qlora  | 4-bit                                       | instruction JSONL          | |
| cpt    | 4-bit                                       | synthetic raw-text JSONL   | packing + embeddings + separate embedding LR |
| full   | forced **16-bit**, no adapters              | instruction JSONL          | trains all params |
| vision | `Qwen2-VL-2B-Instruct-bnb-4bit`             | `unsloth/Radiology_mini` (HF) | image+text → chat messages |

Datasets for text methods are synthesised locally (torch-free) under
`storage/validation/fixtures/`. Vision uses a small Hugging Face image dataset
(images can't be synthesised into JSONL), so it needs network access.

Override any of these:

```bash
python -m validation.gpu_validate run \
  --text-model unsloth/Llama-3.2-1B-Instruct-bnb-4bit \
  --vision-model unsloth/Llama-3.2-11B-Vision-Instruct-bnb-4bit \
  --vision-dataset your-org/your-image-dataset
```

## Pass criteria

For each method the harness reads the job record the sink wrote and requires **all** of:

- `status == "completed"` and `progress == 100`
- `total_steps` was streamed (proves progress is real step-based, not faked)
- a `loss` value was recorded (the training loop actually produced metrics)
- `step` advanced past 0
- `final/` on disk holds a weight file (`*.safetensors`/`*.bin`) **and** tokenizer/processor files
- `run_manifest.json` exists next to it

## Output

- Console: a per-method PASS/FAIL table with loss, steps, VRAM, and time.
- JSON: full results written to `storage/validation/report_<timestamp>.json`.
- **Exit code 0** only if every selected method PASSED — so this fits a GPU CI job.

Run output directories are deleted after each case by default; pass `--keep` to
inspect the trained adapters/manifests.

## Troubleshooting

- **`unsloth MISSING` / `No CUDA device`** in preflight → the stack or GPU isn't
  available; nothing will train. Install the stack / run on a GPU box.
- **Vision fails to import `FastVisionModel` / `UnslothVisionDataCollator`** → the
  installed Unsloth version is too old; upgrade `unsloth`.
- **`full` fails with a `full_finetuning` kwarg error** → Unsloth too old for
  full fine-tuning; upgrade, or skip with `--methods sft,lora,qlora,cpt`.
- **Multi-GPU hangs or errors** → the installed Unsloth build may not support DDP;
  validate single-GPU first, then `--gpus 2`.
