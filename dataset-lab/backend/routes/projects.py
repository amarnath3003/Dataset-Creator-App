import json
import shutil
from fastapi import APIRouter, HTTPException
from backend.models import ProjectCreate, QAPairPayload
from backend.utils.filesystem import create_project, list_projects, get_project_path

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


@router.post("/{project_name}/data/qa")
def add_qa_pair(project_name: str, payload: QAPairPayload):
    project_path = get_project_path(project_name)
    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    qa_path = project_path / "qa_v1.json"
    pairs = json.loads(qa_path.read_text(encoding="utf-8")) if qa_path.exists() else []
    q = (payload.question or payload.instruction or "").strip()
    a = (payload.answer or payload.output or "").strip()
    if not q or not a:
        raise HTTPException(status_code=400, detail="Both question and answer are required")
    item = {
        "question": q,
        "answer": a,
        "input": payload.input or "",
        "rejected": payload.rejected or "",
        "quality_score": 1.0,
        "chunk_id": -1,
    }
    pairs.append(item)
    qa_path.write_text(json.dumps(pairs, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"message": "QA pair added", "index": len(pairs) - 1, "item": item, "count": len(pairs)}


@router.put("/{project_name}/data/qa/{index}")
def update_qa_pair(project_name: str, index: int, payload: QAPairPayload):
    project_path = get_project_path(project_name)
    qa_path = project_path / "qa_v1.json"
    if not qa_path.exists():
        raise HTTPException(status_code=404, detail="QA pairs not found")
    pairs = json.loads(qa_path.read_text(encoding="utf-8"))
    if index < 0 or index >= len(pairs):
        raise HTTPException(status_code=404, detail="QA index out of range")
    item = pairs[index]
    if payload.question is not None:
        item["question"] = payload.question
    if payload.instruction is not None:
        item["question"] = payload.instruction
    if payload.answer is not None:
        item["answer"] = payload.answer
    if payload.output is not None:
        item["answer"] = payload.output
    if payload.input is not None:
        item["input"] = payload.input
    if payload.rejected is not None:
        item["rejected"] = payload.rejected
    pairs[index] = item
    qa_path.write_text(json.dumps(pairs, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"message": "QA pair updated", "index": index, "item": item}


@router.delete("/{project_name}/data/qa/{index}")
def delete_qa_pair(project_name: str, index: int):
    project_path = get_project_path(project_name)
    qa_path = project_path / "qa_v1.json"
    if not qa_path.exists():
        raise HTTPException(status_code=404, detail="QA pairs not found")
    pairs = json.loads(qa_path.read_text(encoding="utf-8"))
    if index < 0 or index >= len(pairs):
        raise HTTPException(status_code=404, detail="QA index out of range")
    removed = pairs.pop(index)
    qa_path.write_text(json.dumps(pairs, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"message": "QA pair deleted", "removed": removed, "count": len(pairs)}


@router.delete("/{project_name}/data/chunks/{chunk_id}")
def delete_chunk(project_name: str, chunk_id: int):
    project_path = get_project_path(project_name)
    chunks_path = project_path / "chunks.json"
    if not chunks_path.exists():
        raise HTTPException(status_code=404, detail="Chunks not found")
    chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
    filtered = [c for c in chunks if c.get("chunk_id") != chunk_id]
    if len(filtered) == len(chunks):
        raise HTTPException(status_code=404, detail="Chunk not found")
    chunks_path.write_text(json.dumps(filtered, indent=2, ensure_ascii=False), encoding="utf-8")
    return {"message": "Chunk deleted", "count": len(filtered)}


@router.get("/{project_name}/logs")
def get_project_logs(project_name: str):
    project_path = get_project_path(project_name)
    if not project_path.exists():
        raise HTTPException(status_code=404, detail="Project not found")
    err_path = project_path / "error.log"
    prog_path = project_path / "progress.json"
    return {
        "error_log": err_path.read_text(encoding="utf-8", errors="replace") if err_path.exists() else "",
        "progress": json.loads(prog_path.read_text(encoding="utf-8")) if prog_path.exists() else None,
    }
