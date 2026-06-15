from fastapi import APIRouter

router = APIRouter()

@router.post("/hf")
def export_to_hf():
    return {"status": "Exported to HF"}

@router.post("/gguf")
def export_to_gguf():
    return {"status": "Exported to GGUF"}
