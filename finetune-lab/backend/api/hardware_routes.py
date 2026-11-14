"""Hardware detection API.

``torch`` is imported lazily inside the handler so the API still boots on a
machine without the training stack (GPU detection just reports none).
"""
from typing import Any

from fastapi import APIRouter

router = APIRouter()


@router.get("/gpus")
def list_gpus():
    from core.hardware_engine.estimator import GPUDetector

    ref_gpus = GPUDetector.get_reference_gpus()
    try:
        gpus = GPUDetector.get_gpus()
    except Exception as exc:  # torch missing / driver error
        return {"gpus": [], "reference_gpus": ref_gpus, "cuda": False, "count": 0, "error": str(exc)}

    real = [g for g in gpus if g.get("vram_total", 0) > 0]
    return {
        "gpus": gpus,
        "reference_gpus": ref_gpus,
        "cuda": len(real) > 0,
        "count": len(real),
    }


@router.post("/estimate")
def estimate_hardware(payload: dict[str, Any]):
    from core.hardware_engine.estimator import Estimator

    return Estimator.estimate_vram(
        model_name=str(payload.get("model_name") or "llama-3-8b"),
        dataset_size=int(payload.get("dataset_size") or 1000),
        training_method=str(payload.get("training_method") or "qlora"),
        batch_size=int(payload.get("batch_size") or 2),
        seq_length=int(payload.get("seq_length") or 2048),
        lora_rank=int(payload.get("lora_rank") or 16),
        epochs=float(payload.get("epochs") or 3),
        grad_accum=int(payload.get("grad_accum") or 4),
        gpu_vram_gb=float(payload.get("gpu_vram_gb") or 24.0),
    )
