from job_engine.job_store import update_job
from core.training_engine.factory import TrainerFactory


def run_training_job(job):

    job_id = job["id"]

    update_job(
        job_id,
        {
            "status": "running"
        }
    )

    try:

        trainer = TrainerFactory.create(
            training_type=job["training_type"],
            model_name=job["model"],
            dataset_path=job["dataset_path"],
            config={"job_id": job_id, **job["config"]} # Inject job_id for the trainer callback simulation
        )

        trainer.prepare()

        trainer.train()

        trainer.save()

        update_job(
            job_id,
            {
                "status": "completed",
                "progress": 100
            }
        )

    except Exception as e:

        update_job(
            job_id,
            {
                "status": "failed",
                "error": str(e)
            }
        )
