import time

from workers.training_worker import run_training_job
from .queue import pop_job


def start_worker():

    while True:

        job = pop_job()

        if job:

            print("Running job", job["id"])

            run_training_job(job)

        time.sleep(2)

if __name__ == "__main__":
    print("Starting worker process...")
    start_worker()
