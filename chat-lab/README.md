<div align="center">

# 💬 Chat Lab

**The third lab in the pipeline — chat with, test, and compare the models you trained in Finetune Lab.**

`Dataset Lab` → `Finetune Lab` → **`Chat Lab`**

</div>

---

## What it is

Finetune Lab turns a dataset into a trained model (a PEFT **LoRA/QLoRA adapter** saved
on disk). Chat Lab is where you **actually use and evaluate that model** before exporting
or shipping it:

- **Chat** — multi-turn, streaming conversation with any fine-tuned run or base model,
  with a live system-prompt editor, full generation controls, stop, and regenerate.
- **Compare** — run the same prompt through two models side by side. One click sets up
  **base-vs-fine-tuned** (does my training actually change the output?), or pit two
  checkpoints against each other (A/B).
- **History** — save, reopen, and export conversations to Markdown.
- **Presets** — batch a fixed set of prompts through a model for quick, repeatable
  sanity checks of a fine-tune.

Every response shows **tokens, tokens/sec, and time-to-first-token**.

It runs **local, single-user, single-GPU, Windows-first**, and **reuses the runs Finetune
Lab already produced** — no extra export step.

---

## How it connects to Finetune Lab

Chat Lab does **not** train anything. It reads Finetune Lab's output directly:

| Finetune Lab writes | Chat Lab reads |
|---|---|
| `finetune-lab/backend/storage/runs/{id}/final/` (adapter + tokenizer) | loads it for inference |
| `finetune-lab/backend/storage/runs/{id}/run_manifest.json` | base model, quantization, context length |
| `finetune-lab/backend/storage/jobs.json` | which runs are `completed` |
| `finetune-lab/backend/model_registry/models.json` | base models to chat with / compare against |

A completed run shows up in the model picker automatically. Those paths are configured in
[`backend/config.py`](backend/config.py).

---

## Architecture

```
ChatPage / ComparePage / Presets (React)        FastAPI                       Engine (deferred ML imports)
──────────────────────────────────────────────────────────────────────────────────────────────────────────
ModelPicker ─────────────► GET  /api/models/finetuned ──► run_registry  ──► (reads Finetune Lab storage)
                           GET  /api/models/base       ──► run_registry  ──► (reads model registry)
Chat (SSE stream) ───────► POST /api/chat/stream  ─────► ModelManager.get ─► UnslothFastLanguageModel
                              │ token deltas as SSE        (load/evict)        .for_inference()
                              ▼                                  │             TextIteratorStreamer
                           POST /api/chat/stop  ──────────► threading.Event ◄─┘ (cancellable in a thread)
Compare / Presets ───────► POST /api/chat/compare ─────► generate_full (blocking, per target)
History ─────────────────► /api/conversations (CRUD + export.md)
```

**Inference engine:** Unsloth `FastLanguageModel` loads the saved adapter directory
directly (it resolves the base model from `adapter_config.json`) and enables fast
inference; a HuggingFace **transformers + PEFT** path is the automatic fallback. Tokens
stream via `TextIteratorStreamer` running `model.generate` on a background thread, relayed
to the browser as **SSE**, and cancelled mid-flight by a `threading.Event` (set on
`/stop` or browser disconnect).

**Boots without the ML stack:** all torch/unsloth/transformers imports are deferred, so
the API starts and lists models even on a machine without a GPU — loading a model then
returns a clear, actionable error.

---

## Quick start (manual)

> Ports: backend **8100**, frontend **5273** (kept clear of Dataset/Finetune Lab).

```bash
# 1) Backend  (use the same Python env that has your training stack: torch/unsloth/peft)
cd chat-lab/backend
pip install -r requirements.txt
python start_backend.py            # -> http://localhost:8100

# 2) Frontend (new terminal)
cd chat-lab/frontend
npm install
npm run dev                        # -> http://localhost:5273
```

Open http://localhost:5273, pick a fine-tuned run (or a base model) in the right-hand
panel, and start chatting.

> **GPU note:** the backend must run in an environment where `torch` + `unsloth` (+ `peft`,
> `bitsandbytes`) are installed and a CUDA GPU is visible — the same environment you used
> for Finetune Lab. The API still boots without them; the GPU status pill in the top-right
> turns green when a CUDA device is detected.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/models/finetuned` | Fine-tuned runs with loadable weights on disk |
| `GET` | `/api/models/base` | Base models from the Finetune Lab registry |
| `GET` | `/api/models/status` | Resident models, GPU/VRAM snapshot, torch availability |
| `POST` | `/api/models/load` | Warm a model into VRAM (`{run_id}` or `{base_model}`) |
| `POST` | `/api/models/unload` | Free a model (omit body to free all) |
| `POST` | `/api/chat/stream` | Stream a reply (SSE: `meta`/`ready`/`start`/`token`/`done`/`error`) |
| `POST` | `/api/chat/stop` | Cancel an active stream (`{stream_id}`) |
| `POST` | `/api/chat/compare` | One reply per target for the same prompt |
| `GET/POST/DELETE` | `/api/conversations[...]` | Conversation CRUD + `/{id}/export.md` |

---

## Generation defaults

`temperature 0.7 · top_p 0.9 · top_k 20 · repetition_penalty 1.1 · max_new_tokens 512`.
`temperature 0` → greedy/deterministic. All adjustable per-chat in the UI. Chat Lab always
applies each model's **own** tokenizer chat template (`apply_chat_template`,
`add_generation_prompt=True`) and trims the oldest turns to fit the context window.

---

## Status

**v1 — full studio scaffolded and verified off-GPU.** API boots torch-free, routes +
model discovery + conversation CRUD tested, frontend builds and lints clean. **Remaining:
validate a real GPU chat/compare** on a machine with the training stack installed.
