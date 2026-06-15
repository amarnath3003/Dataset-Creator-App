from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from backend.utils.filesystem import get_project_path
from backend.engines.scraping.manager import manager, ScrapeRequest, RefineRequest

router = APIRouter()


@router.post("/start")
async def start_scraping_job(request: ScrapeRequest):
    """
    Start a new scraping background job.
    """
    if not request.urls and not request.query and not request.category:
        raise HTTPException(
            status_code=400,
            detail="Must provide at least one of: urls, query, or category.",
        )

    project_dir = get_project_path(request.project_name)
    if (project_dir / ".scraping").exists():
        raise HTTPException(status_code=409, detail="A scraping job is already running for this project.")
    if (project_dir / ".refining").exists():
        raise HTTPException(status_code=409, detail="A refinement job is currently running for this project.")
        
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / ".scraping").touch()

    task_id = manager.start_job(request)
    return {"message": "Scraping job started successfully.", "task_id": task_id}


@router.post("/refine")
async def start_refining_job(request: RefineRequest):
    """
    Start a new background job to refine scraped text using LLMs.
    """
    project_dir = get_project_path(request.project_name)
    if (project_dir / ".refining").exists():
        raise HTTPException(status_code=409, detail="A refinement job is already running for this project.")
    if (project_dir / ".scraping").exists():
        raise HTTPException(status_code=409, detail="A scraping job is currently running for this project.")
        
    project_dir.mkdir(parents=True, exist_ok=True)
    (project_dir / ".refining").touch()

    task_id = manager.start_refinement_job(request)
    return {"message": "Refinement job started successfully.", "task_id": task_id}


class TestRefinementRequest(BaseModel):
    raw_text: str
    provider: str = "local"
    model_name: str = "llama3.2"
    api_key: str = ""
    system_prompt: str = ""


@router.post("/test_refinement")
async def test_refinement(request: TestRefinementRequest):
    """
    Dry run the AI text refinement on sample text.
    """
    from backend.engines.scraping.refinement import refine_text_with_llm

    try:
        refined = await refine_text_with_llm(
            raw_text=request.raw_text,
            provider=request.provider,
            model_name=request.model_name,
            api_key=request.api_key,
            system_prompt=request.system_prompt,
        )
        return {"refined_text": refined}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}")
async def get_scraping_status(task_id: str):
    """
    Check the progress and logs of a scraping job.
    """
    status = manager.get_job_status(task_id)
    if not status:
        raise HTTPException(status_code=404, detail="Task not found.")
    return status


@router.post("/cancel/{task_id}")
async def cancel_scraping_job(task_id: str):
    """
    Cancel an ongoing scraping job.
    """
    manager.cancel_job(task_id)
    return {"message": "Cancellation requested for task."}


@router.get("/preview/{project_name}")
async def get_scrape_preview(project_name: str):
    """
    Get a preview of the scraped text and images for a project.
    """
    project_dir = get_project_path(project_name)
    raw_file = project_dir / "raw.txt"
    images_dir = project_dir / "scraped" / "images"

    text_preview = ""
    if raw_file.exists():
        with open(raw_file, "r", encoding="utf-8") as file:
            file.seek(0, 2)  # Move to end of file
            file_size = file.tell()
            # Read the last 2000 characters for the preview
            seek_pos = max(0, file_size - 2000)
            file.seek(seek_pos)
            text_preview = file.read()
            if seek_pos > 0:
                # Truncate at the first newline to avoid partial lines if possible
                first_newline = text_preview.find("\n")
                if first_newline != -1:
                    text_preview = "...\n" + text_preview[first_newline + 1 :]
                else:
                    text_preview = "...\n" + text_preview

    image_files = []
    if images_dir.exists():
        files_with_mtime = []
        for f in images_dir.iterdir():
            if f.is_file():
                files_with_mtime.append((f, f.stat().st_mtime))
        # Sort by mtime descending (newest first)
        files_with_mtime.sort(key=lambda x: x[1], reverse=True)
        image_files = [f[0].name for f in files_with_mtime[:12]]

    return {"text": text_preview, "images": image_files}


@router.get("/download/{project_name}")
async def download_scrape_data(project_name: str, background_tasks: BackgroundTasks):
    """
    Download the scraped text and images as a ZIP file.
    """
    import zipfile
    import tempfile

    project_dir = get_project_path(project_name)
    scraped_dir = project_dir / "scraped"
    raw_file = project_dir / "raw.txt"

    if not scraped_dir.exists() and not raw_file.exists():
        raise HTTPException(status_code=404, detail="Scraped data not found")

    fd, zip_path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)

    # Manual zip generation to prevent grabbing other pipeline files (chunks.json, qa.json, error.logs)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        if raw_file.exists():
            zipf.write(raw_file, arcname="raw.txt")
        if scraped_dir.exists():
            for root, dirs, files in os.walk(scraped_dir):
                for file in files:
                    file_path = os.path.join(root, file)
                    # Create a friendly archive structure like 'images/img.jpg' or 'text/doc.json'
                    arcname = os.path.relpath(file_path, scraped_dir)
                    zipf.write(file_path, arcname=arcname)

    background_tasks.add_task(os.remove, zip_path)

    return FileResponse(
        path=zip_path,
        filename=f"{project_name}_scraped_data.zip",
        media_type="application/zip",
    )


@router.get("/image/{project_name}/{image_name}")
async def get_scraped_image(project_name: str, image_name: str):
    """
    Serve a scraped image file.
    """
    project_dir = get_project_path(project_name)
    image_path = project_dir / "scraped" / "images" / image_name
    if image_path.exists():
        return FileResponse(image_path)
    raise HTTPException(status_code=404, detail="Image not found")
