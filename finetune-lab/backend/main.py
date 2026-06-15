from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import training_routes, model_routes, dataset_routes, export_routes

app = FastAPI(
    title="Finetune Lab API",
    description="Backend API for Finetune Lab LLM Studio",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(training_routes.router, prefix="/api/training", tags=["Training"])
app.include_router(model_routes.router, prefix="/api/models", tags=["Models"])
app.include_router(dataset_routes.router, prefix="/api/datasets", tags=["Datasets"])
app.include_router(export_routes.router, prefix="/api/export", tags=["Export"])

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Finetune Lab API"}
