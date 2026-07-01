# Finetune Lab — Build Roadmap

> **Update 2026-06-30 — all training methods implemented (Phases 0–7).** The four blocking
> bugs are fixed and the canonical `UnslothSFTRunner` (+ `UnslothVisionRunner` subclass) is
> wired through the live path. The wizard submits a real `TrainingRequest`; RunDashboard shows
> true step-based progress / loss / VRAM / ETA / streaming logs. Implemented end-to-end:
> **SFT, LoRA, QLoRA, CPT, Full, and Vision (VLM)**, each single- or multi-GPU (DDP via
> `accelerate`). Quantization is mode-derived (QLoRA/SFT/CPT → 4-bit, LoRA/Full → 16-bit with
> the matching non-`bnb-4bit` checkpoint); LoftQ, rsLoRA, embedding-LR (CPT), and vision layer
> flags all flow end-to-end. Verified off-GPU: torch-free API boot, route table, event→record
> translation (real progress), dataset format detection, quant/model-id resolution, full/CPT/
> vision config mapping, adapter-config log rendering.
> **Remaining: validate actual GPU runs** on a machine with the ML stack (torch/unsloth/trl) —
> especially multi-GPU and vision, which depend on the installed Unsloth version's support.
> A **GPU validation harness** now exists for exactly this — `backend/validation/`
> (`python -m validation.gpu_validate preflight | run [--all] | selftest`). It drives the
> real `run_service → gpu_worker → runner` path for every method on a tiny model + few steps
> and asserts completion, real step-based progress, live loss, and saved artifacts. The
> torch-free `selftest` (payload→config mapping, fixtures, validators) passes off-GPU today;
> `run` is what you execute on the GPU box to close out Phases 5–7. See
> `backend/validation/README.md`.
>
> **Design principle (per user):** every setting must be user-tunable from the frontend over
> time. The seam is the free-form `hyperparameters` dict — see the Hyperparameter Contract
> appendix; new UI controls flow to the engine with **no backend change**.

> Status: **early skeleton.** The wizard UI, model registry, and a strong (but orphaned)
> SFT engine exist. The end-to-end path from "click Start" to "model trained" is **not yet
> connected**, and there are several parallel half-built implementations that need to converge.
>
> This document is the plan to take Finetune Lab from skeleton to a complete, local
> fine-tuning studio. We build it **one training method at a time, vertically** — SFT first,
> all the way through (UI → API → engine → live monitoring → export), then reuse that spine
> for LoRA/QLoRA/CPT/Full/Vision.

---

## 1. Product vision

Finetune Lab is the second half of the Dataset → Model pipeline. Dataset Lab produces a
JSONL dataset; Finetune Lab turns it into a trained model on local GPU, through a guided
5-step wizard, with no training code written by the user:

**Model → Dataset → Config → Hardware → Run** → exported adapter / GGUF / Hub model.

---

## 2. Current state — honest diagnosis

### 2.1 Three parallel engine implementations (must converge on ONE)

| # | Location | Quality | Wired in? |
|---|----------|---------|-----------|
| 1 | `core/training_engine/sft_trainer.py`, `lora_trainer.py`, `qlora_trainer.py` (flat) | thin / legacy | no |
| 2 | `core/training_engine/trainers/*.py` + `base/` (`SFTTrainerEngine`, `TrainerFactory`) | thin | **yes** — API uses this |
| 3 | `training/unsloth_sft_runner.py` (`UnslothSFTRunner`) | **production-grade** (OOM retry, multi-schema formatting, artifact saving, manifest, rich streaming) | no (orphaned) |

**Decision: Engine #3 becomes the canonical engine.** It is by far the most complete. We
wrap it behind the `TrainerFactory` dispatch pattern from #2, and delete #1 and the thin
trainer bodies of #2.

### 2.2 Blocking bugs (SFT cannot run from the UI today)

1. **Double route prefix.** `main.py` mounts the training router at `/api/training`, but
   `training_routes.py` *also* declares `APIRouter(prefix="/training")`. Real path becomes
   `/api/training/training/create`. The frontend calls `/api/training/create` → **404**.
2. **Wizard config is thrown away.** `training_routes.create` hardcodes `lora_rank`,
   `lora_alpha`, `max_seq_length`, `packing`, etc. and only forwards `batch_size`,
   `learning_rate`, `epochs`. Every control on the Config page is ignored.
3. **Streaming callback ↔ sink mismatch.** The wired engine (#2) uses `StreamingCallback`,
   which emits events with **no `run_id` and no `type`**. `JobStoreSink.emit` returns early
   when there is no `run_id`, so **loss and progress never update**. (Engine #3's
   `StreamingMetricsCallback` *does* emit `run_id`+`type` and is compatible with the sink —
   another reason to standardize on #3.)
4. **Fake progress math.** `JobStoreSink` computes `progress = min(100, step/100*100)` — it
   has no notion of total steps, so the bar is meaningless. Total steps must be computed and
   streamed.

### 2.3 Stubbed / missing pieces

- **Hardware page has no backend.** `GPUDetector` + `Estimator` exist but **no route exposes
  them** (no hardware router in `main.py`). The Hardware page cannot show real GPUs/VRAM.
- **Datasets are mocked.** `dataset_routes` returns `{"datasets": []}`; the UI shows
  hardcoded "Alpaca Cleaned" cards. No bridge to Dataset Lab exports, no upload handling.
- **Export is stubbed.** `export_routes` returns fake strings. Real `gguf_exporter`,
  `quantizer`, `hf_publisher` exist in `utils/` but are unwired.
- **No job control.** Runs use FastAPI `BackgroundTasks` (lost on restart, not cancellable).
  The `job_engine/` (queue/worker) and `db/` (SQLAlchemy) scaffolding are unused.
- **Fragile storage.** Everything writes to relative `storage/jobs.json` / `storage/runs/...`
  (CWD-dependent). No run history, no per-run metadata persistence.
- **Wizard not submitted.** State is threaded through `location.state` across pages, but the
  final POST + redirect to `/finetune/runs/:id` needs verifying/finishing on the Hardware page.

---

## 3. Target architecture (canonical pipeline)

```
Wizard (React)                     FastAPI                      Engine                 Storage
─────────────────────────────────────────────────────────────────────────────────────────────
ModelSelection ─┐
DatasetSelection ┤ builds one      POST /api/training/runs ──► run_service.create ──► runs table
TrainingConfig  ─┤ TrainingRequest                              │                     (SQLite)
HardwareSelect  ─┘ object                                       ▼
                                                        worker.run_job(run_id)
                                                                │
                                                   TrainerFactory.create(cfg, sink)
                                                                │
                                                     UnslothSFTRunner.run()  ◄─ canonical engine
                                                                │ emits typed events
                                                                ▼
RunDashboard ◄── GET /runs/:id/status (poll)  ◄──  JobStore/EventSink (jobs.json → SQLite)
            ◄── GET /runs/:id/events  (SSE, later)
                                                                │ on success
                                                       artifacts: adapter + tokenizer +
                                                       run_manifest.json  (+ GGUF/Hub later)
```

**Single source of truth for config:** one Pydantic `TrainingRequest` at the API boundary →
mapped to the engine's dataclass. No field is silently dropped.

---

## 4. Guiding principles

1. **Vertical slices, not horizontal layers.** Finish SFT end-to-end before starting LoRA.
2. **One engine, one config, one sink.** Delete duplicates as we go; no new parallel paths.
3. **Real data over mocks** at every step the slice touches.
4. **Local-first, single-GPU, single-user** assumptions (matches `start.bat` deployment).
   Multi-GPU / queueing are explicit later phases, not baked in early.
5. **Every run is inspectable and recoverable** — manifest on disk, status survives restart.

---

## 5. Phase overview

| Phase | Title | Outcome |
|-------|-------|---------|
| **0** | Consolidation & wiring fix | One engine, routes fixed, config flows through. Nothing new, but the existing slice stops being broken. |
| **1** | **SFT vertical slice** ← *we start here* | Pick model + JSONL + config + GPU → click Start → real training with live loss/progress → saved adapter. |
| 2 | Dataset pipeline | Real dataset listing (Dataset Lab bridge + upload), validation, format auto-detect + preview. |
| 3 | Hardware intelligence | Real GPU detection route, accurate VRAM/time estimate, pre-flight "will it fit?" guard. |
| 4 | LoRA & QLoRA | Add adapter-config pages wired through the same spine. |
| 5 | CPT (continued pre-training) | Raw-text corpus path + packing. |
| 6 | Full fine-tune & multi-GPU | `accelerate`/distributed, memory guard. |
| 7 | Vision (VLM) | Multimodal dataset + trainer. |
| 8 | Export & publish | GGUF, quantize, merge-to-16bit, push-to-Hub — wired & UI'd. |
| 9 | Run management & persistence | SQLite history, cancel/resume/delete, SSE live logs, restart-safe worker. |
| 10 | Packaging & integration | One-command launch with Dataset Lab, installer, docs. |

---

## 6. Phase 0 — Consolidation & wiring fix

*Goal: the existing pieces form one coherent, working spine. No new features.*

- [ ] **Fix double prefix.** Remove the inner `prefix="/training"` (and align the others) so
      paths match the frontend: `POST /api/training/create`, `GET /api/training/status/{id}`.
- [ ] **Adopt `UnslothSFTRunner` as canonical.** Have `TrainerFactory.create("sft", ...)`
      construct it (adapter shim around the new unified config). Keep the factory seam for
      future methods.
- [ ] **Unify config.** Define one `TrainingRequest` (API) → map every field into the runner's
      `SFTTrainingConfig`. Stop hardcoding LoRA/seq-length/packing in the route.
- [ ] **Delete dead code.** Remove flat Engine #1 files and the thin `SFTTrainerEngine` body
      once the runner is wired. Remove unused `job_engine/`/`db` imports for now (revisit Ph 9).
- [ ] **Fix the sink contract.** Standardize on typed events (`type`, `run_id`) and make
      `JobStoreSink` compute progress from `global_step / total_steps`.
- [ ] **Pin storage root.** Resolve `storage/` against a known base dir, not CWD.

**Done when:** a hand-crafted `curl` to `/api/training/create` with a tiny JSONL trains for a
few steps and `jobs.json` shows real, advancing loss/progress.

---

## 7. Phase 1 — SFT vertical slice  ← **START HERE**

*Goal: a user completes the wizard and watches a real SFT run to completion, then finds a
saved adapter on disk. This is the spine every later method reuses.*

### 7.1 Backend

- [ ] **`TrainingRequest` schema** (Pydantic): `model_name`, `dataset_path`, `training_type`,
      and a typed `hyperparameters` block (epochs, lr, batch_size, grad_accum, max_seq_length,
      packing, save_steps, seed, warmup_ratio, lr_scheduler, optim). Validation with sane
      bounds + defaults.
- [ ] **`run_service`**: create run (uuid, persisted record), resolve `output_dir`, enqueue.
- [ ] **Wire `UnslothSFTRunner`** through `TrainerFactory` for `training_type == "sft"`.
- [ ] **Total-steps computation** (`ceil(rows / (batch*grad_accum)) * epochs`, or honor
      `max_steps`) streamed in `train_begin` so progress % is real.
- [ ] **Status endpoint** returns: status, progress %, latest loss, lr, epoch, step/total,
      VRAM, ETA, and a rolling **log tail** for the terminal panel.
- [ ] **Artifact contract**: on success, `storage/runs/{id}/final/` holds adapter + tokenizer
      + `run_manifest.json`; status flips to `completed` with a pointer to artifacts.
- [ ] **Failure surfacing**: OOM and generic errors land in status with a readable message
      (runner already produces these — just surface them).

### 7.2 Frontend

- [ ] **Model page**: load real registry via `modelApi` (already mostly there); filter the
      method list to models whose `supports` includes the chosen method.
- [ ] **Dataset page**: minimum real path — accept a JSONL **upload** → backend stores it and
      returns a `dataset_path`. (Full Dataset Lab bridge is Phase 2; here we just need a real
      file to train on.) Remove the mock cards or clearly mark them as samples.
- [ ] **Config page**: already rich; ensure it only forwards SFT-relevant fields and writes
      them into the wizard state as the typed `hyperparameters` block.
- [ ] **Hardware page**: submit point — assemble `TrainingRequest` from `location.state`,
      `POST` it, then redirect to `/finetune/runs/{id}`. (Real GPU detect = Phase 3; for now a
      static "GPU 0" card is acceptable.)
- [ ] **RunDashboard**: consume the richer status — live loss number, **real** progress bar,
      epoch/step counters, VRAM readout, ETA, streaming **log lines** in the terminal panel,
      and terminal states (completed → show artifact path + "Export" CTA; failed → show error).

### 7.3 Acceptance criteria (Phase 1 "definition of done")

1. Fresh wizard run with a real uploaded JSONL (~50 rows) and Qwen-2.5-3B QLoRA-style SFT
   **starts, streams advancing loss, completes**, and writes a loadable adapter + manifest.
2. The progress bar reflects true step/total; the loss shown matches the training log.
3. A forced OOM (tiny VRAM / huge seq len) surfaces a clean "out of memory" failure, and the
   runner's auto-fallback retry is visible in the log.
4. No code path references Engine #1 or the thin `SFTTrainerEngine` body anymore.

---

## 8. Phases 2–10 (summary)

### Phase 2 — Dataset pipeline
- `GET /api/datasets` lists Dataset Lab exports (scan `dataset-lab/projects/**/export`) **and**
  uploaded files. Upload endpoint with validation.
- Wire `dataset_engine/detector.py` + `formatter.py`: detect INSTRUCTION/COMPLETION/CHATML/
  SHAREGPT/PREFERENCE, show a **preview + row count + detected schema** in the UI.
- Reject PREFERENCE data for SFT with a helpful message (that's DPO, a later method).

### Phase 3 — Hardware intelligence
- New hardware router: `GET /api/hardware/gpus` (real `GPUDetector`), `POST /api/hardware/estimate`
  (real `Estimator`, given model+method+batch+seq+rows).
- Pre-flight guard: compare estimate vs detected VRAM; warn/block before launch; suggest
  fixes (lower seq len, enable 4-bit, smaller batch).

### Phase 4 — LoRA & QLoRA
- Reuse the SFT spine; the engine already does PEFT. Expose rank/alpha/dropout/rslora/loftq
  (UI exists) end-to-end. QLoRA = `load_in_4bit` + `paged_adamw_8bit` presets.

### Phase 5 — CPT  ✅ (2026-06-30)
- Implemented as a config variant of the canonical runner (no parallel engine): raw-text
  training (no instruction template), EOS appended per document, packing on by default,
  `embed_tokens` + `lm_head` added to target modules, and a separate (lower) embedding LR via
  Unsloth's CPT trainer with graceful fallback to a single LR. CPT defaults: 1 epoch, lr 5e-5,
  embedding lr = lr/10, linear schedule. Frontend exposes Train-Embeddings + Embedding-LR.
  **Needs GPU validation.** Note: corpus is a `text` column in JSONL today; raw `.txt` upload
  is a future enhancement.

### Phase 6 — Full fine-tune & multi-GPU  ✅ (2026-06-30)
- **Full fine-tuning:** `FastLanguageModel.from_pretrained(full_finetuning=True)`, no PEFT
  adapters, 16-bit base forced (model id auto-resolved off `-bnb-4bit`), lr default 2e-5, clear
  error if the installed Unsloth lacks the kwarg.
- **Multi-GPU (DDP):** any method can set `num_gpus > 1` → the run is launched via
  `accelerate launch` on a standalone entry script (`training/train_entry.py`); telemetry is
  gated to rank 0 in the sink (`training/runtime.is_main_process`) so processes don't race on
  `jobs.json`. The parent waits and reports terminal status; failures surface the subprocess
  stderr tail.
- **Hardware detection:** `GET /api/hardware/gpus` (lazy torch, graceful when absent); the
  Hardware page shows detected GPUs and a multi-GPU selector.
- **Needs GPU validation** — especially multi-GPU, which depends on the installed Unsloth
  version supporting DDP. `utils/memory_guard.py` wiring + `vision` remain.

### Phase 7 — Vision (VLM)  ✅ (2026-06-30)
- `UnslothVisionRunner` subclasses the text runner (reuses OOM retry, streaming, artifact
  saving, manifest, rank gating) and overrides three things: `FastVisionModel` load + vision
  LoRA flags (`finetune_{vision,language,attention,mlp}`), image+text → chat `messages`
  formatting (auto-detects image/text columns, or uses a pre-formatted `messages` column), and
  an `UnslothVisionDataCollator`-based trainer with vision SFTConfig kwargs.
- Registry gains vision models (Llama-3.2-11B-Vision, Qwen2-VL-7B). Dataset picker adds a
  **Hugging Face dataset-id** source (image datasets aren't uploadable as JSONL). Config page
  exposes the four layer toggles + the instruction prompt. Works single- or multi-GPU.
- **Needs GPU validation** — depends on the installed Unsloth exposing `FastVisionModel` /
  `UnslothVisionDataCollator` (import locations handled defensively).

### Phase 8 — Export & publish
- Wire `gguf_exporter` (llama.cpp convert + quant types q4_k_m etc.), `quantizer`, merge
  adapter→16bit, `hf_publisher` (token, repo, private). Real `export_routes`. Post-run Export
  panel in RunDashboard.

### Phase 9 — Run management & persistence
- Move job state from `jobs.json` → SQLite (`db/` models). Run history list page.
- Replace `BackgroundTasks` with a restart-safe worker (`job_engine/`), supporting
  **cancel / resume-from-checkpoint / delete**. SSE endpoint for live logs (replace polling).

### Phase 10 — Packaging & integration
- Single launcher that runs Dataset Lab + Finetune Lab together; installer updates; "Send to
  Finetune Lab" handoff from a Dataset Lab export; README + screenshots.

---

## 9. Cross-cutting concerns (tracked throughout)

- **Error UX**: every failure shows a human message + actionable fix, never a raw traceback.
- **Reproducibility**: `run_manifest.json` captures exact config, model, dataset hash, metrics.
- **Safety rails**: VRAM pre-flight, dataset schema validation, disk-space check before save.
- **Design system**: all new UI uses the neumorphic kit in `skill.md`.
- **No secrets in logs**: HF tokens redacted in events/manifest.

---

## Appendix — Hyperparameter Contract (full tunability seam)

The API accepts `TrainingRequest.hyperparameters` as a free-form dict. The worker
(`gpu_worker._build_sft_config`) reads each key below into the engine, so the **frontend can
expose any of these incrementally with no backend change**. "UI" = already has a control.

| Key | Type | Default | UI? | Notes |
|-----|------|---------|-----|-------|
| `epochs` | float | 3 | ✅ | `num_train_epochs` |
| `max_steps` | int | -1 | — | overrides epochs when > 0 |
| `learning_rate` | float | 2e-4 | ✅ | |
| `batch_size` | int | 2 | ✅ | per-device micro-batch |
| `gradient_accumulation` | int | 4 | ✅ | |
| `max_seq_length` | int | 2048 | ✅ | |
| `packing` | bool | false | ✅ | sequence packing |
| `save_steps` | int | 200 | ✅ | |
| `warmup_ratio` | float | 0.03 | — | |
| `weight_decay` | float | 0.0 | — | |
| `lr_scheduler_type` | str | cosine | — | linear/cosine/… |
| `optim` | str | paged_adamw_8bit | — | |
| `seed` | int | 3407 | — | |
| `lora_rank` | int | 16 | ✅ | |
| `lora_alpha` | int | 16 | ✅ | |
| `lora_dropout` | float | 0.0 | ✅ | |
| `use_rslora` | bool | false | ✅ | rank-stabilized LoRA |
| `use_loftq` | bool | false | ✅ | 4-bit only; graceful fallback |
| `train_embeddings` | bool | true (CPT) | ✅ (CPT) | adds embed_tokens + lm_head |
| `embedding_learning_rate` | float | lr/10 (CPT) | ✅ (CPT) | separate embedding LR |
| `append_eos` | bool | true (CPT) | — | EOS per raw-text document |
| `full_finetuning` | bool | derived (mode) | — | set by `full` mode; trains all params |
| `target_modules` | list | unsloth default 7 | — | advanced |
| `bias` | str | none | — | advanced |
| `load_in_4bit` | bool | derived from mode | — | explicit override wins |
| `dtype` | str | auto | — | bf16/fp16/fp32 |

Quantization is otherwise derived from `training_type`: **QLoRA/SFT/CPT → 4-bit**, **LoRA → 16-bit**,
**Full → 16-bit** (loads the matching non-`bnb-4bit` checkpoint). `num_gpus` is a **top-level**
`TrainingRequest` field (not a hyperparameter); `>1` launches DDP via accelerate. When adding
"Full tunability" UI, add controls that write the hyperparameter keys into the wizard's
`trainingConfig`; they arrive as `hyperparameters`.

---

## 10. Immediate next actions (this milestone)

1. Phase 0 wiring fixes (prefix, config flow, sink contract, canonical engine).
2. Phase 1 backend: `TrainingRequest` + `run_service` + total-steps + rich status.
3. Phase 1 frontend: dataset upload, wizard submit on Hardware page, rich RunDashboard.
4. Validate against the Phase 1 acceptance criteria with a real tiny dataset.
</content>
</invoke>
