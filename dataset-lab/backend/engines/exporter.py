import json
import re
from pathlib import Path
from typing import Dict, Any
from fastapi import HTTPException


class Exporter:
    def __init__(self):
        self.formats_path = Path(__file__).parent.parent / "formats" / "formats.json"

    def _load_formats(self) -> Dict[str, Any]:
        if not self.formats_path.exists():
            raise RuntimeError("formats.json not found")
        with open(self.formats_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _normalize_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        question = item.get("question") or item.get("instruction") or ""
        answer = item.get("answer") or item.get("output") or ""
        inp = item.get("input") or ""
        rejected = item.get("rejected") or "The requested detail is not supported by the source material."
        return {
            **item,
            "question": question,
            "answer": answer,
            "instruction": question,
            "output": answer,
            "input": inp,
            "rejected": rejected,
        }

    def export(
        self,
        project_path: Path,
        format: str,
        target_path: Path | None = None,
    ) -> Path:
        qa_path = project_path / "qa_v1.json"
        chunks_path = project_path / "chunks.json"

        # Support exporting raw chunks in 'completion' mode even without QA pairs
        if format == "completion" and not qa_path.exists() and chunks_path.exists():
            chunks = json.loads(chunks_path.read_text(encoding="utf-8"))
            export_dir = project_path / "exports"
            export_dir.mkdir(parents=True, exist_ok=True)
            export_path = target_path or (export_dir / f"{project_path.name}_completion.jsonl")
            with open(export_path, "w", encoding="utf-8") as f:
                for c in chunks:
                    text = c.get("text", "") if isinstance(c, dict) else str(c)
                    if text.strip():
                        f.write(json.dumps({"text": text.strip()}, ensure_ascii=False) + "\n")
            return export_path

        if not qa_path.exists():
            raise HTTPException(
                status_code=404, detail="qa_v1.json not found. Run generation first."
            )

        formats = self._load_formats()
        if format not in formats:
            raise HTTPException(
                status_code=400,
                detail=f"Format '{format}' not supported. Available: {list(formats.keys())}",
            )

        template = formats[format].get("template")
        if not template:
            raise HTTPException(
                status_code=500, detail=f"Template for format '{format}' is missing."
            )

        with open(qa_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        data = [self._normalize_item(item) for item in raw_data if isinstance(item, dict)]

        export_type = formats[format].get("type", "jsonl")
        export_ext = "json" if export_type == "json" else "jsonl"
        export_dir = project_path / "exports"
        export_dir.mkdir(parents=True, exist_ok=True)
        export_path = target_path or (export_dir / f"{project_path.name}_{format}.{export_ext}")

        with open(export_path, "w", encoding="utf-8") as f:
            if export_type == "json":
                transformed_data = [self._transform(template, item) for item in data]
                json.dump(transformed_data, f, indent=2, ensure_ascii=False)
            else:
                for item in data:
                    transformed_item = self._transform(template, item)
                    f.write(json.dumps(transformed_item, ensure_ascii=False) + "\n")

        return export_path

    def _transform(self, template: Any, data: Dict[str, Any]) -> Any:
        if isinstance(template, str):
            val = template
            placeholders = re.findall(r"\{([a-zA-Z0-9_]+)\}", val)
            for p in placeholders:
                if p in data:
                    val = val.replace(f"{{{p}}}", str(data[p]))
            return val
        elif isinstance(template, dict):
            return {k: self._transform(v, data) for k, v in template.items()}
        elif isinstance(template, list):
            return [self._transform(i, data) for i in template]
        else:
            return template


exporter = Exporter()
