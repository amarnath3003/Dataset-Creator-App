import json
import logging
from typing import Any
from core.training_engine.base.trainer_factory import TrainerFactory
from core.training_engine.base.base_config import TrainingConfig
from core.training_engine.utils.gguf_exporter import export
from core.training_engine.utils.hf_publisher import push
from training.job_store_sink import JobStoreSink

logger = logging.getLogger(__name__)

class RedisPubSubSink:
    def __init__(self, redis_client, channel: str):
        self.redis = redis_client
        self.channel = channel

    def emit(self, event: dict[str, Any]) -> None:
        self.redis.publish(self.channel, json.dumps(event, default=str))

def run_training_job(job_payload: dict[str, Any], redis_client=None) -> dict[str, Any]:
    config = TrainingConfig(**job_payload)

    if redis_client is not None:
        sink = RedisPubSubSink(redis_client, f"training:{config.run_id}")
    else:
        sink = JobStoreSink()

    trainer = TrainerFactory.create(config, sink)
    
    # Run the training
    trainer.train()

    if config.export_gguf:
        export(trainer.model, trainer.tokenizer)

    if config.push_to_hub:
        push(trainer.model, trainer.tokenizer, config.hf_repo)
        
    return {"status": "succeeded", "run_id": config.run_id}
