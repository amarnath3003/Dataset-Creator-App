import json
from pathlib import Path
from fastapi import HTTPException
from typing import Dict, Any


class Exporter:
    def __init__(self):
        self.formats_path = Path(__file__).parent.parent / "formats" / "formats.json"

    def _load_formats(self) -> Dict[str, Any]:
        if not self.formats_path.exists():
            raise RuntimeError("formats.json not found")
        with open(self.formats_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def export(self, project_path: Path, format: str):
        qa_path = project_path / "qa_v1.json"

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
            data = json.load(f)

        export_type = formats[format].get("type", "jsonl")
        export_ext = "json" if export_type == "json" else "jsonl"
        import uuid
        export_path = project_path / f"export_{format}_{uuid.uuid4().hex[:8]}.{export_ext}"

        with open(export_path, "w", encoding="utf-8") as f:
            if export_type == "json":
                # JSON array output
                transformed_data = [self._transform(template, item) for item in data]
                json.dump(transformed_data, f, indent=2)
            else:
                # Default to JSONL output
                for item in data:
                    transformed_item = self._transform(template, item)
                    f.write(json.dumps(transformed_item) + "\n")

        return export_path

    def _transform(self, template: Any, data: Dict[str, str]) -> Any:
        if isinstance(template, str):
            val = template
            # Safely replace any format string placeholder present in the item dictionary
            # Example: '{question}' -> data['question']
            import re

            placeholders = re.findall(r"\{(.*?)\}", val)
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
