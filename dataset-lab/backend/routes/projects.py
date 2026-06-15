from fastapi import APIRouter, HTTPException
from backend.models import ProjectCreate
from backend.utils.filesystem import create_project, list_projects, get_project_path
import shutil

router = APIRouter()


@router.get("/")
def list_all_projects():
    return list_projects()


@router.post("/")
def create_new_project(project: ProjectCreate):
    try:
        path = create_project(project.name)
        return {"message": f"Project {project.name} created", "path": str(path)}
    except FileExistsError:
        raise HTTPException(status_code=400, detail="Project already exists")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_name}")
def delete_project(project_name: str):
    path = get_project_path(project_name)
    if path.exists():
        shutil.rmtree(path)
        return {"message": f"Project {project_name} deleted"}
    raise HTTPException(status_code=404, detail="Project not found")
