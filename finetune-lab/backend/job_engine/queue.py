_mock_queue = []

def push_job(job):
    print(f"Pushing job: {job}")
    _mock_queue.append(job)
    return True

def pop_job():
    if _mock_queue:
        return _mock_queue.pop(0)
    return None
