import json
import os
from datetime import datetime

JOB_FILE = "storage/jobs.json"


def _load():

    if not os.path.exists(JOB_FILE):
        return {}

    with open(JOB_FILE, "r") as f:
        return json.load(f)


def _save(data):

    with open(JOB_FILE, "w") as f:
        json.dump(data, f, indent=2)


def create_job(job_id, job_data):

    jobs = _load()

    jobs[job_id] = {
        **job_data,
        "status": "queued",
        "created_at": str(datetime.now()),
        "progress": 0,
        "loss": None
    }

    _save(jobs)


def update_job(job_id, updates):

    jobs = _load()

    if job_id in jobs:
        jobs[job_id].update(updates)
        _save(jobs)


def get_job(job_id):

    jobs = _load()

    return jobs.get(job_id)
