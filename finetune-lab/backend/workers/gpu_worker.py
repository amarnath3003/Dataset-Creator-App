from __future__ import annotations

import json
import logging
from dataclasses import asdict
from typing import Any

from training.unsloth_sft_runner import (
    PrintSink,
    SFTTrainingConfig,
    UnslothSFTRunner,
)
from training.job_store_sink import JobStoreSink

logger = logging.getLogger(__name__)


class RedisPubSubSink:
    """
    Replace this with your actual websocket / Redis publisher.
    """
    def __init__(self, redis_client, channel: str):
        self.redis = redis_client
        self.channel = channel

    def emit(self, event: dict[str, Any]) -> None:
        self.redis.publish(self.channel, json.dumps(event, default=str))


def run_training_job(job_payload: dict[str, Any], redis_client=None) -> dict[str, Any]:
    """
    Entry point executed by your worker process.

    job_payload example:
    {
      "run_id": "run_123",
      "model_name": "unsloth/Qwen2.5-3B-Instruct",
      "dataset_source": "/data/run_123/train.jsonl",
      "output_dir": "/runs/run_123",
      "max_seq_length": 2048,
      ...
    }
    """
    cfg = SFTTrainingConfig(**job_payload)

    if redis_client is not None:
        sink = RedisPubSubSink(redis_client, f"training:{cfg.run_id}")
    else:
        # Use JobStoreSink by default so frontend polling still works
        sink = JobStoreSink()

    runner = UnslothSFTRunner(cfg, sink)
    result = runner.run()

    return asdict(result)
