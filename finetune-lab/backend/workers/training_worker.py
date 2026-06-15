from core.training_engine.factory import TrainerFactory


def run_training_job(job):

    trainer = TrainerFactory.create(
        training_type=job["training_type"],
        model_name=job["model"],
        dataset_path=job["dataset_path"],
        config=job["config"]
    )

    trainer.prepare()

    trainer.train()

    trainer.save()
