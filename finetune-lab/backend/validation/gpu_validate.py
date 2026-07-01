"""GPU validation harness - end-to-end checks for every training method.

Run this on a machine that has the ML stack (torch / unsloth / trl / peft /
accelerate) installed and a CUDA GPU. It exercises the *real* production path -
``run_service.create_run`` -> ``run_service.dispatch`` -> ``gpu_worker`` ->
``UnslothSFTRunner`` / ``UnslothVisionRunner`` - for each method, using a tiny
model, a tiny synthetic dataset and a few steps, then asserts the run completed
with real progress/loss and wrote loadable artifacts.

Usage (from the backend directory):

    python -m validation.gpu_validate preflight
    python -m validation.gpu_validate run                 # all text methods
    python -m validation.gpu_validate run --all           # + vision
    python -m validation.gpu_validate run --methods sft,full --steps 6
    python -m validation.gpu_validate run --methods sft --gpus 2   # multi-GPU DDP
    python -m validation.gpu_validate list

Exit code is 0 only if every selected method PASSED (preflight failures and any
FAIL/ERROR make it non-zero), so it drops cleanly into CI on a GPU runner.
"""
from __future__ import annotations

# Allow both `python -m validation.gpu_validate` and `python validation/gpu_validate.py`.
import os
import sys

_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)

import argparse
import json
import time
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from config import RUNS_DIR
from job_engine import job_store
from services import run_service
from validation import fixtures

# --------------------------------------------------------------------------- #
# Defaults - tiny, known-good Unsloth checkpoints so a full sweep is quick.
# One 4-bit text id is enough: the worker strips ``-bnb-4bit`` and forces a
# 16-bit base for LoRA/Full itself, so this also validates that resolution.
# --------------------------------------------------------------------------- #
DEFAULT_TEXT_MODEL = "unsloth/Qwen2.5-0.5B-Instruct-bnb-4bit"
DEFAULT_VISION_MODEL = "unsloth/Qwen2-VL-2B-Instruct-bnb-4bit"
DEFAULT_VISION_DATASET = "unsloth/Radiology_mini"

ALL_METHODS = ["sft", "lora", "qlora", "cpt", "full", "vision"]
TEXT_METHODS = ["sft", "lora", "qlora", "cpt", "full"]


# --------------------------------------------------------------------------- #
# Request shim - mirrors api.training_routes.TrainingRequest so we can reuse the
# exact run_service path without going through HTTP.
# --------------------------------------------------------------------------- #
@dataclass
class _Req:
    model_name: str
    dataset_path: str
    training_type: str = "sft"
    num_gpus: int = 1
    hyperparameters: dict[str, Any] = field(default_factory=dict)


@dataclass
class CaseResult:
    method: str
    status: str  # PASS | FAIL | ERROR
    run_id: Optional[str] = None
    job_status: Optional[str] = None
    steps: Optional[int] = None
    total_steps: Optional[int] = None
    loss: Optional[float] = None
    vram_mb: Optional[float] = None
    duration_s: float = 0.0
    final_dir: Optional[str] = None
    reasons: list[str] = field(default_factory=list)
    error: Optional[str] = None


# --------------------------------------------------------------------------- #
# Preflight
# --------------------------------------------------------------------------- #
def _pkg_version(mod_name: str) -> str:
    try:
        mod = __import__(mod_name)
    except Exception as exc:  # noqa: BLE001
        return f"MISSING ({type(exc).__name__})"
    return getattr(mod, "__version__", "unknown")


def preflight() -> bool:
    """Report the ML stack + GPUs. Returns True if the stack is usable."""
    print("=" * 68)
    print("  Finetune Lab - GPU validation preflight")
    print("=" * 68)

    ok = True
    print("\n[packages]")
    for name in ("torch", "unsloth", "trl", "transformers", "peft",
                 "datasets", "accelerate", "bitsandbytes"):
        ver = _pkg_version(name)
        mark = "x" if ver.startswith("MISSING") else "+"
        if ver.startswith("MISSING") and name in ("torch", "unsloth", "trl"):
            ok = False
        print(f"  [{mark}] {name:<14} {ver}")

    print("\n[cuda / gpus]")
    try:
        import torch

        cuda = torch.cuda.is_available()
        print(f"  torch.cuda.is_available(): {cuda}")
        if not cuda:
            print("  [x] No CUDA device visible - training cannot run.")
            ok = False
        else:
            print(f"  torch.version.cuda:        {torch.version.cuda}")
            from core.hardware_engine.estimator import GPUDetector

            for g in GPUDetector.get_gpus():
                print(f"  [+] GPU {g['id']}: {g['name']} - {g['vram_total']} MB")
                if torch.cuda.is_bf16_supported():
                    pass
            print(f"  bf16 supported:            {torch.cuda.is_bf16_supported()}")
    except Exception as exc:  # noqa: BLE001
        print(f"  [x] GPU probe failed: {exc}")
        ok = False

    print("\n[result] preflight", "PASS" if ok else "FAIL")
    return ok


# --------------------------------------------------------------------------- #
# Per-method job payloads
# --------------------------------------------------------------------------- #
def _base_hp(steps: int) -> dict[str, Any]:
    """Small, fast hyperparameters shared by every text method.

    save_steps < max_steps so we also exercise mid-run checkpoint saving.
    """
    return {
        "max_steps": steps,
        "epochs": 1,
        "batch_size": 1,
        "gradient_accumulation": 1,
        "max_seq_length": 256,
        "logging_steps": 1,
        "save_steps": max(1, steps // 2),
        "warmup_ratio": 0.0,
        "lr_scheduler_type": "constant",
        "packing": False,
    }


def _build_req(method: str, args: argparse.Namespace, steps: int) -> _Req:
    hp = _base_hp(steps)

    if method in ("sft", "lora", "qlora"):
        return _Req(model_name=args.text_model, dataset_path=fixtures.instruction_dataset(),
                    training_type=method, num_gpus=args.gpus, hyperparameters=hp)

    if method == "cpt":
        hp["packing"] = True
        hp["train_embeddings"] = True
        hp["append_eos"] = True
        return _Req(model_name=args.text_model, dataset_path=fixtures.text_corpus_dataset(),
                    training_type="cpt", num_gpus=args.gpus, hyperparameters=hp)

    if method == "full":
        # Full fine-tuning trains all params in 16-bit; keep it to a couple steps.
        return _Req(model_name=args.text_model, dataset_path=fixtures.instruction_dataset(),
                    training_type="full", num_gpus=args.gpus, hyperparameters=hp)

    if method == "vision":
        hp["max_seq_length"] = 512
        return _Req(model_name=args.vision_model, dataset_path=args.vision_dataset,
                    training_type="vision", num_gpus=args.gpus, hyperparameters=hp)

    raise ValueError(f"Unknown method: {method}")


# --------------------------------------------------------------------------- #
# Validation of a finished run
# --------------------------------------------------------------------------- #
def _validate_artifacts(job: dict) -> list[str]:
    """Return a list of failure reasons (empty == artifacts look good)."""
    reasons: list[str] = []
    final_dir = job.get("final_dir")
    if not final_dir:
        reasons.append("no final_dir recorded")
        return reasons

    fd = Path(final_dir)
    if not fd.exists():
        reasons.append(f"final_dir does not exist: {fd}")
        return reasons

    files = [p.name for p in fd.iterdir()]
    if not any(n.endswith(".safetensors") or n.endswith(".bin") for n in files):
        reasons.append(f"no weight file (*.safetensors/*.bin) in {fd.name}")
    if not any("token" in n or "processor" in n or "vocab" in n or "merges" in n
               for n in files):
        reasons.append(f"no tokenizer/processor files in {fd.name}")

    manifest = fd.parent / "run_manifest.json"
    if not manifest.exists():
        reasons.append("run_manifest.json missing")
    return reasons


def _validate_job(job: Optional[dict], expected_steps: int) -> list[str]:
    reasons: list[str] = []
    if job is None:
        return ["job record not found in job store"]

    if job.get("status") != "completed":
        reasons.append(f"status={job.get('status')} (expected completed); "
                       f"error={job.get('error')}")
    if job.get("progress") != 100:
        reasons.append(f"progress={job.get('progress')} (expected 100)")

    total = job.get("total_steps")
    if not total or total <= 0:
        reasons.append("total_steps not streamed (progress would be fake)")
    if job.get("loss") is None:
        reasons.append("no loss recorded (training loop produced no metrics)")
    if not job.get("step"):
        reasons.append("step never advanced")

    reasons.extend(_validate_artifacts(job))
    return reasons


# --------------------------------------------------------------------------- #
# Run one method
# --------------------------------------------------------------------------- #
def run_case(method: str, args: argparse.Namespace) -> CaseResult:
    steps = args.steps
    print(f"\n{'-' * 68}\n[{method}] starting ({steps} steps, gpus={args.gpus})\n{'-' * 68}")
    started = time.time()
    try:
        req = _build_req(method, args, steps)
    except Exception as exc:  # noqa: BLE001
        return CaseResult(method=method, status="ERROR",
                          error=f"config build failed: {exc}",
                          duration_s=time.time() - started)

    try:
        run = run_service.create_run(req)
        run_id = run["run_id"]
    except Exception as exc:  # noqa: BLE001
        return CaseResult(method=method, status="ERROR",
                          error=f"create_run failed: {exc}\n{traceback.format_exc()}",
                          duration_s=time.time() - started)

    try:
        # This is the real dispatch path: single-GPU runs in-process, multi-GPU
        # launches accelerate. It emits terminal status into the job store itself.
        run_service.dispatch(run["payload"])
    except Exception as exc:  # noqa: BLE001
        return CaseResult(method=method, status="ERROR", run_id=run_id,
                          error=f"dispatch raised: {exc}\n{traceback.format_exc()}",
                          duration_s=time.time() - started)

    duration = time.time() - started
    job = job_store.get_job(run_id)
    reasons = _validate_job(job, steps)
    job = job or {}

    result = CaseResult(
        method=method,
        status="PASS" if not reasons else "FAIL",
        run_id=run_id,
        job_status=job.get("status"),
        steps=job.get("step"),
        total_steps=job.get("total_steps"),
        loss=job.get("loss"),
        vram_mb=job.get("vram_mb"),
        duration_s=round(duration, 1),
        final_dir=job.get("final_dir"),
        reasons=reasons,
        error=job.get("error"),
    )

    if result.status == "PASS":
        print(f"[{method}] PASS - loss={result.loss} steps={result.steps}/"
              f"{result.total_steps} vram={result.vram_mb}MB {result.duration_s}s")
    else:
        print(f"[{method}] FAIL - {'; '.join(reasons)}")

    if not args.keep and result.final_dir:
        _cleanup_run(run_id)
    return result


def _cleanup_run(run_id: str) -> None:
    import shutil

    run_dir = RUNS_DIR / run_id
    try:
        if run_dir.exists():
            shutil.rmtree(run_dir, ignore_errors=True)
    except Exception:  # noqa: BLE001
        pass
    # Also drop the job record so validation runs don't pollute the store.
    try:
        job_store.delete_job(run_id)
    except Exception:  # noqa: BLE001
        pass


# --------------------------------------------------------------------------- #
# Report
# --------------------------------------------------------------------------- #
def _print_report(results: list[CaseResult]) -> None:
    print("\n" + "=" * 68)
    print("  VALIDATION REPORT")
    print("=" * 68)
    hdr = f"  {'method':<8} {'status':<6} {'loss':<9} {'steps':<9} {'vram(MB)':<9} {'time(s)':<8}"
    print(hdr)
    print("  " + "-" * (len(hdr) - 2))
    for r in results:
        loss = "-" if r.loss is None else f"{r.loss:.4f}"
        steps = "-" if r.steps is None else f"{r.steps}/{r.total_steps}"
        vram = "-" if not r.vram_mb else f"{r.vram_mb:.0f}"
        print(f"  {r.method:<8} {r.status:<6} {loss:<9} {steps:<9} {vram:<9} {r.duration_s:<8}")
    print()
    for r in results:
        if r.status != "PASS":
            detail = r.error or "; ".join(r.reasons)
            print(f"  ! [{r.method}] {r.status}: {detail}")

    passed = sum(1 for r in results if r.status == "PASS")
    print(f"\n  {passed}/{len(results)} methods PASSED")


def _write_report(results: list[CaseResult], args: argparse.Namespace) -> Path:
    out_dir = fixtures.VALIDATION_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    path = out_dir / f"report_{stamp}.json"
    payload = {
        "timestamp": stamp,
        "text_model": args.text_model,
        "vision_model": args.vision_model,
        "steps": args.steps,
        "gpus": args.gpus,
        "results": [r.__dict__ for r in results],
        "passed": sum(1 for r in results if r.status == "PASS"),
        "total": len(results),
    }
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return path


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def _resolve_methods(args: argparse.Namespace) -> list[str]:
    if args.methods:
        picked = [m.strip().lower() for m in args.methods.split(",") if m.strip()]
        bad = [m for m in picked if m not in ALL_METHODS]
        if bad:
            raise SystemExit(f"Unknown method(s): {bad}. Valid: {ALL_METHODS}")
        return picked
    return ALL_METHODS if args.all else TEXT_METHODS


def cmd_run(args: argparse.Namespace) -> int:
    # Validate method names up front so a typo fails fast, even off-GPU.
    methods = _resolve_methods(args)

    if not preflight():
        print("\n[abort] Preflight failed - fix the stack/GPU before running.")
        return 2

    if args.gpus > 1:
        try:
            import torch

            have = torch.cuda.device_count()
            if have < args.gpus:
                print(f"\n[abort] Requested --gpus {args.gpus} but only {have} visible.")
                return 2
        except Exception:  # noqa: BLE001
            pass

    print(f"\n[plan] methods={methods} steps={args.steps} "
          f"text_model={args.text_model}")

    results = [run_case(m, args) for m in methods]

    _print_report(results)
    report_path = _write_report(results, args)
    print(f"\n  report -> {report_path}")

    return 0 if all(r.status == "PASS" for r in results) else 1


def cmd_preflight(_args: argparse.Namespace) -> int:
    return 0 if preflight() else 1


def cmd_list(_args: argparse.Namespace) -> int:
    print("Methods:", ", ".join(ALL_METHODS))
    print(f"Default text model:   {DEFAULT_TEXT_MODEL}")
    print(f"Default vision model: {DEFAULT_VISION_MODEL}")
    print(f"Default vision data:  {DEFAULT_VISION_DATASET}")
    return 0


# --------------------------------------------------------------------------- #
# Self-test — torch-free checks of the harness + the payload->config wiring that
# every real run depends on. Runs anywhere (no GPU), so it guards regressions in
# the plumbing before you get to a GPU box.
# --------------------------------------------------------------------------- #
def _selftest_config_mapping() -> list[str]:
    """Push each method's payload through the real create_run + _build_config
    path and assert the engine config comes out mapped correctly."""
    from workers.gpu_worker import _build_config

    fails: list[str] = []

    class _A:  # stand-in for argparse.Namespace
        text_model = DEFAULT_TEXT_MODEL
        vision_model = DEFAULT_VISION_MODEL
        vision_dataset = DEFAULT_VISION_DATASET
        gpus = 1

    def check(method: str, assertions) -> None:
        req = _build_req(method, _A(), steps=4)
        run = run_service.create_run(req)
        cfg = _build_config(run["payload"])
        for label, ok in assertions(cfg):
            if not ok:
                fails.append(f"[{method}] {label}")
        _cleanup_run(run["run_id"])

    check("sft", lambda c: [
        ("load_in_4bit is True", c.load_in_4bit is True),
        ("model keeps 4bit id", c.model_name.endswith("-bnb-4bit")),
        ("max_steps propagated", c.max_steps == 4),
    ])
    check("lora", lambda c: [
        ("load_in_4bit is False", c.load_in_4bit is False),
        ("model id resolved to 16-bit", not c.model_name.endswith("-bnb-4bit")),
    ])
    check("qlora", lambda c: [
        ("load_in_4bit is True", c.load_in_4bit is True),
    ])
    check("cpt", lambda c: [
        ("train_embeddings True", c.train_embeddings is True),
        ("embedding_learning_rate set", c.embedding_learning_rate is not None),
        ("append_eos True", c.append_eos is True),
        ("packing True", c.packing is True),
    ])
    check("full", lambda c: [
        ("full_finetuning True", c.full_finetuning is True),
        ("load_in_4bit forced False", c.load_in_4bit is False),
        ("model id resolved to 16-bit", not c.model_name.endswith("-bnb-4bit")),
    ])
    check("vision", lambda c: [
        ("vision layer flags present", c.finetune_vision_layers is True),
        ("dataset is the HF id", c.dataset_source == DEFAULT_VISION_DATASET),
    ])
    return fails


def _selftest_fixtures() -> list[str]:
    fails: list[str] = []
    inst = Path(fixtures.instruction_dataset())
    corp = Path(fixtures.text_corpus_dataset())
    for label, path, key in (("instruction", inst, "output"), ("corpus", corp, "text")):
        if not path.exists():
            fails.append(f"fixture {label} not written")
            continue
        rows = [json.loads(ln) for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]
        if not rows:
            fails.append(f"fixture {label} empty")
        elif key not in rows[0]:
            fails.append(f"fixture {label} missing key '{key}'")
    return fails


def _selftest_validators() -> list[str]:
    """The pass/fail logic must accept a good job and reject broken ones."""
    fails: list[str] = []
    good = {"status": "completed", "progress": 100, "total_steps": 4,
            "loss": 1.23, "step": 4, "final_dir": None}
    # No final_dir -> artifact check fails; strip that concern for the "good" shape
    # by pointing final_dir at a dir we fake below is overkill — instead assert the
    # non-artifact validators pass on the good job.
    core_reasons = [r for r in _validate_job(good, 4) if "final_dir" not in r and "manifest" not in r]
    if core_reasons:
        fails.append(f"good job wrongly rejected: {core_reasons}")

    bad_cases = {
        "not completed": {"status": "failed", "progress": 0, "total_steps": 4, "loss": 1.0, "step": 1},
        "fake progress": {"status": "completed", "progress": 100, "total_steps": None, "loss": 1.0, "step": 1},
        "no loss": {"status": "completed", "progress": 100, "total_steps": 4, "loss": None, "step": 1},
        "no step": {"status": "completed", "progress": 100, "total_steps": 4, "loss": 1.0, "step": 0},
    }
    for label, job in bad_cases.items():
        if not _validate_job(job, 4):
            fails.append(f"broken job accepted: {label}")
    if _validate_job(None, 4) == []:
        fails.append("None job accepted")
    return fails


def cmd_selftest(_args: argparse.Namespace) -> int:
    print("=" * 68)
    print("  GPU-validation self-test (torch-free plumbing checks)")
    print("=" * 68)
    groups = [
        ("payload->config mapping", _selftest_config_mapping),
        ("fixtures", _selftest_fixtures),
        ("run validators", _selftest_validators),
    ]
    all_fails: list[str] = []
    for name, fn in groups:
        try:
            fails = fn()
        except Exception as exc:  # noqa: BLE001
            fails = [f"{name} raised: {exc}\n{traceback.format_exc()}"]
        mark = "PASS" if not fails else "FAIL"
        print(f"  [{mark}] {name}")
        for f in fails:
            print(f"        - {f}")
        all_fails.extend(fails)

    print("\n[result] self-test", "PASS" if not all_fails else "FAIL")
    return 0 if not all_fails else 1


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="gpu_validate", description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("preflight", help="Check the ML stack + GPUs, no training.").set_defaults(func=cmd_preflight)
    sub.add_parser("list", help="List methods and default models.").set_defaults(func=cmd_list)
    sub.add_parser("selftest", help="Torch-free plumbing checks (no GPU needed).").set_defaults(func=cmd_selftest)

    r = sub.add_parser("run", help="Run the validation sweep.")
    r.add_argument("--methods", help="Comma list (e.g. sft,full). Default: all text methods.")
    r.add_argument("--all", action="store_true", help="Include vision (needs network + a VLM).")
    r.add_argument("--steps", type=int, default=4, help="Training steps per method (default 4).")
    r.add_argument("--gpus", type=int, default=1, help="GPUs per run (>1 = DDP via accelerate).")
    r.add_argument("--text-model", default=DEFAULT_TEXT_MODEL, help="Base id for text methods.")
    r.add_argument("--vision-model", default=DEFAULT_VISION_MODEL, help="Base id for vision.")
    r.add_argument("--vision-dataset", default=DEFAULT_VISION_DATASET, help="HF dataset id for vision.")
    r.add_argument("--keep", action="store_true", help="Keep run output dirs (default: delete).")
    r.set_defaults(func=cmd_run)
    return p


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
