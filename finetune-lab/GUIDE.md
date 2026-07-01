# Finetune Lab — Run Guide

No-code, local LLM fine-tuning studio. Pick a model → pick a dataset → configure →
watch it train live → export. This guide takes you from a fresh clone to a trained
adapter.

```
Model → Dataset → Config → Hardware → Review → Launch → Monitor → Export
```

---

## 1. Prerequisites

| Need | Why | Notes |
|------|-----|-------|
| **Python 3.10+** | Backend API + training | 3.10/3.11 recommended (Unsloth support) |
| **Node.js 18+** | Frontend dev server | includes `npm` |
| **NVIDIA GPU + CUDA** | Actual training | Required only to *run* training. The UI, dataset upload, estimates, and run history all work without a GPU. |

Two processes run side by side:
- **Backend** (FastAPI) on `http://localhost:8000`
- **Frontend** (Vite/React) on `http://localhost:5173`

---

## 2. Install

### Backend

```bash
cd finetune-lab/backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
```

**If you have an NVIDIA GPU** (this is the path that lets you actually train):
plain `pip install -r requirements.txt` silently gives you the **CPU-only** torch
wheel even with a GPU present — no error, `torch.cuda.is_available()` just returns
`False` and training fails at launch. Install the full stack, then force the CUDA
build of torch:

```bash
# 1) install everything (this resolves unsloth's pins; torch may come as CPU)
pip install -r requirements.txt

# 2) note the torch version pip settled on
python -c "import torch; print(torch.__version__)"     # e.g. 2.10.0

# 3) reinstall that exact version from the CUDA index (cu126 carries 2.10+;
#    cu124 only goes to 2.6.0). --no-deps so nothing else gets disturbed.
pip install --index-url https://download.pytorch.org/whl/cu126 \
    torch==<version-from-step-2> torchvision --force-reinstall --no-deps

# 4) verify — MUST print True and a +cuXXX build
python -c "import torch; print(torch.cuda.is_available(), torch.__version__)"
# expect: True 2.x.x+cu126
```

A newer driver runs older `cuXXX` wheels fine (forward compatible), so cu126 is a
safe default. Verified combo: RTX 3070 / driver 591.59 → `torch 2.10.0+cu126`,
`bitsandbytes 0.49.2`, `unsloth 2026.6.9`, trains end-to-end.

**No GPU / just exploring the UI?** The training stack is imported lazily and
only touched at "Launch" — everything else (dataset upload, model registry,
wizard, run history) works fine without it:
```bash
pip install fastapi uvicorn python-multipart pydantic
```

### Frontend

```bash
cd finetune-lab/frontend
npm install
```

---

## 3. Run

**Terminal 1 — backend:**

```bash
cd finetune-lab/backend
python start_backend.py
```
Serves on `http://0.0.0.0:8000` with auto-reload. Sanity check: open
`http://localhost:8000/docs` — you should see the API (models, datasets, training,
export, hardware).

**Terminal 2 — frontend:**

```bash
cd finetune-lab/frontend
npm run dev
```
Open the printed URL (default `http://localhost:5173`).

> **Different backend host/port?** Create `finetune-lab/frontend/.env`:
> ```
> VITE_API_URL=http://your-host:8000
> ```

---

## 4. End-to-end flow

Everything below is driven from the sidebar of the web app.

### Step 0 — Dashboard
Landing page: recent runs, detected GPUs, quick **New Run**. Click **New Run** (or
sidebar → New Run).

### Step 1 — Model
Three sources:
- **Registry** — curated Unsloth models (Llama 3, Mistral, Qwen, Gemma, Phi, + two
  Vision models). Recommended.
- **Hugging Face** — paste any repo id, e.g. `unsloth/llama-3-8b-Instruct-bnb-4bit`.
- **Local File** — absolute path to a model dir on the training server.

Registry models show which methods they support; the Config step filters to those.

### Step 2 — Dataset
- **Upload** a `.jsonl` / `.json` / `.csv` file. The backend auto-detects the schema
  and row count. Supported schemas for supervised training:

  | Schema | Shape |
  |--------|-------|
  | Instruction | `{"instruction","input","output"}` |
  | ChatML | `{"messages":[{"role","content"}]}` |
  | ShareGPT | `{"conversations":[...]}` |
  | Completion / CPT | `{"text": "..."}` (raw corpus) |

  Preference data (`chosen`/`rejected`) is flagged as DPO-only and blocked for SFT.
- **Hugging Face** — paste a dataset id. Required for **Vision** (image datasets),
  e.g. `unsloth/LaTeX_OCR`.

### Step 3 — Config
- Pick the **method**: QLoRA, LoRA, SFT, Full, CPT, or Vision (list is filtered to
  what the model supports).
- **Smart Config** button auto-fills method/rank/batch/grad-accum from the model
  size — a good starting point.
- Tune core hyperparameters (epochs, LR, batch, grad-accum, seq length) and, under
  **Advanced**, scheduler/optimizer/warmup/decay/save-steps/seed.
- Method-specific panels appear for LoRA (rank/alpha/dropout/rsLoRA/LoftQ), CPT
  (train-embeddings + embedding LR), and Vision (which layers to tune + prompt).

### Step 4 — Hardware
Shows detected CUDA GPUs (or reference cards for estimation if none). Pick a card,
optionally enable **Multi-GPU (DDP)**, and read the VRAM/time estimate + OOM guard.

### Step 5 — Review & Launch
Full summary + the exact hyperparameter payload. Click **Launch Training Run**.

### Step 6 — Monitor (Run Dashboard)
Live: status, loss number **and loss curve**, step/epoch, VRAM, tok/s, ETA, and a
streaming log terminal. **Stop** cancels cooperatively (saves a partial adapter).
Artifacts land in `backend/storage/runs/<run_id>/final/`.

### Step 7 — Export
On a finished (or cancelled) run, the Export panel offers:
- **Adapter** — copy the LoRA adapter (instant, no GPU).
- **Merged 16-bit** — merge base + adapter into a standalone checkpoint.
- **GGUF** — llama.cpp / Ollama format (quant set in Settings).
- **Push to Hub** — upload the merged model to Hugging Face.

For Hub pushes, add your HF token in **Settings** first (stored in your browser's
localStorage; sent only to your local backend for that push). Export jobs are
tracked on the **Exports** page.

---

## 5. Where things live

```
finetune-lab/backend/storage/
  datasets/          uploaded datasets
  runs/<id>/final/   trained adapter + tokenizer + run_manifest.json
  exports/<id>/      merged / gguf artifacts
  jobs.json          run state (status, loss history, logs)
  exports.json       export job state
```

---

## 6. Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Form data requires "python-multipart"` on API boot | `pip install python-multipart` (it's in requirements — you likely booted a different interpreter). |
| Frontend loads but every call fails / CORS | Backend not running on `:8000`, or set `VITE_API_URL`. CORS is already open (`*`). |
| Hardware step shows "Reference GPUs" | No CUDA GPU detected. UI + estimates still work; actual training needs a real GPU. |
| `torch.cuda.is_available()` is `False` **despite having an NVIDIA GPU** | You have the CPU-only torch wheel, not a driver/hardware problem — check with `nvidia-smi` (confirms driver + GPU are fine) then `pip show torch` (if the version has no `+cuXXX` suffix, it's CPU-only). Fix: `pip install --index-url https://download.pytorch.org/whl/cu124 torch --force-reinstall`, matching the cu-tag to your driver. See §2. |
| Launch → run immediately **failed**, log mentions `unsloth`/`torch` | The ML training stack isn't installed in the backend's Python env. Install torch (CUDA) + unsloth on the GPU box. |
| OOM during training | The runner auto-retries with lighter settings (visible in the log). Or lower batch/seq length, enable QLoRA/4-bit. |
| Multi-GPU run fails to launch | Needs `accelerate` installed and >1 CUDA GPU; single-GPU always works. |
| Port 8000 / 5173 already in use | Stop the other process, or change the port (`start_backend.py` / `vite --port`). |

---

## 7. Quick verification (no GPU needed)

You can confirm the whole wiring works without training:

1. Start backend + frontend.
2. New Run → any registry model → upload a small instruction `.jsonl` (a few rows).
3. Walk through Config → Hardware → Review → Launch.
4. The run appears on the **Runs** page and streams status. Without the GPU stack it
   will end in `failed` at the training step — that's expected; every step *before*
   the trainer (upload, detection, run creation, status, stop, delete, export
   guards) is fully functional.

On a GPU box with the ML stack installed, the same flow trains to completion and
writes a loadable adapter.
