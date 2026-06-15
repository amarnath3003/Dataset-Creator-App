from typing import Any
import json
import os

class JobStoreSink:
    """
    Temporary sink that writes events to the shared jobs.json 
    so the frontend RunDashboard polling still works.
    """
    def __init__(self, job_store_path="storage/jobs.json"):
        self.job_store_path = job_store_path

    def emit(self, event: dict[str, Any]) -> None:
        run_id = event.get("run_id")
        if not run_id:
            return
            
        data = self._load()
        if run_id not in data:
            data[run_id] = {"job_id": run_id, "status": "pending", "progress": 0, "loss": None, "error": None}
            
        job = data[run_id]
        
        event_type = event.get("type")
        if event_type == "job_started":
            job["status"] = "running"
        elif event_type == "metrics":
            if "loss" in event:
                job["loss"] = event["loss"]
            
            # Simple progress calculation if epochs exist
            step = event.get("global_step", 0)
            # In a real scenario we need total_steps to calculate progress %, this is a fallback
            job["progress"] = min(100, int((step / 100) * 100)) 
            
        elif event_type == "job_succeeded":
            job["status"] = "completed"
            job["progress"] = 100
        elif event_type in ["job_failed", "oom_failed"]:
            job["status"] = "failed"
            job["error"] = event.get("error", "Unknown error")
            
        self._save(data)
        
    def _load(self):
        if not os.path.exists(self.job_store_path):
            return {}
        with open(self.job_store_path, "r") as f:
            try:
                return json.load(f)
            except json.JSONDecodeError:
                return {}

    def _save(self, data):
        os.makedirs(os.path.dirname(self.job_store_path), exist_ok=True)
        with open(self.job_store_path, "w") as f:
            json.dump(data, f, indent=4)
