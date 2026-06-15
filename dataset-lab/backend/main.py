from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routes import projects, pipeline, export, llm, prompt, scrape

app = FastAPI(title="Dataset Lab API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this should be restricted
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.add_api_route(
    "/", lambda: {"status": "ok", "message": "Dataset Lab API Running"}, methods=["GET"]
)
app.include_router(projects.router, prefix="/projects", tags=["Projects"])
app.include_router(pipeline.router, prefix="/projects", tags=["Pipeline"])
app.include_router(export.router, prefix="/projects", tags=["Export"])
app.include_router(llm.router, prefix="/llm", tags=["LLM"])
app.include_router(prompt.router, prefix="/prompt", tags=["Prompt"])
app.include_router(scrape.router, prefix="/scrape", tags=["Scraping"])

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
