import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.config import settings
from backend.engines.exporter import exporter
from backend.utils.filesystem import get_project_path

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

        is_json = export_path.suffix == ".json"
        return FileResponse(
            path=export_path,
            filename=f"{project_name}_{format}{export_path.suffix}",
            media_type="application/json" if is_json else "application/x-jsonlines",
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{project_name}/export/to-finetune")
def export_to_finetune(project_name: str, format: str = "alpaca"):
    """Export dataset directly into Finetune Lab's dataset library."""
    try:
        project_path = get_project_path(project_name)
        if not project_path.exists():
            raise HTTPException(status_code=404, detail="Project not found")

        finetune_datasets_dir = (
            settings.BASE_DIR / "finetune-lab" / "backend" / "storage" / "datasets"
        )
        finetune_datasets_dir.mkdir(parents=True, exist_ok=True)

        formats = exporter._load_formats()
        if format not in formats:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

        ext = "json" if formats[format].get("type") == "json" else "jsonl"
        dest_filename = f"{project_name}_{format}.{ext}"
        dest_path = finetune_datasets_dir / dest_filename

        exporter.export(project_path, format, target_path=dest_path)

        row_count = 0
        if ext == "json":
            row_count = len(json.loads(dest_path.read_text(encoding="utf-8")))
        else:
            row_count = sum(1 for line in dest_path.read_text(encoding="utf-8").splitlines() if line.strip())

        return {
            "message": f"Exported {row_count} rows to Finetune Lab",
            "filename": dest_filename,
            "path": str(dest_path),
            "format": format,
            "row_count": row_count,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
