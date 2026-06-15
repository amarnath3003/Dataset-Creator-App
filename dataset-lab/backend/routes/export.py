from fastapi import APIRouter, HTTPException
from backend.engines.exporter import exporter
from backend.utils.filesystem import get_project_path
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/{project_name}/export")
def export_dataset(project_name: str, format: str = "alpaca"):
    try:
        project_path = get_project_path(project_name)
        export_path = exporter.export(project_path, format)

        if not export_path or not export_path.exists():
            raise HTTPException(
                status_code=404,
                detail="Export failed or no data found. Did you run generation?",
            )

        # Determine content type and filename based on actual file path suffix
        is_json = export_path.suffix == ".json"

        return FileResponse(
            path=export_path,
            filename=f"export_{format}{export_path.suffix}",
            media_type="application/json" if is_json else "application/x-jsonlines",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
