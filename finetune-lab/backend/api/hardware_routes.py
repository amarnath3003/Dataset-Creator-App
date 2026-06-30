"""Hardware detection API.

``torch`` is imported lazily inside the handler so the API still boots on a
machine without the training stack (GPU detection just reports none).
"""
from fastapi import APIRouter

router = APIRouter()


@router.get("/gpus")
def list_gpus():
    try:
        from core.hardware_engine.estimator import GPUDetector

        gpus = GPUDetector.get_gpus()
    except Exception as exc:  # torch missing / driver error
        return {"gpus": [], "cuda": False, "count": 0, "error": str(exc)}

    real = [g for g in gpus if g.get("vram_total", 0) > 0]
    return {
        "gpus": gpus,
        "cuda": len(real) > 0,
        "count": len(real),
    }
