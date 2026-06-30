"""Standalone training entry point for multi-GPU (DDP) runs.

Launched once per GPU by ``accelerate launch`` (see gpu_worker._run_multi_gpu).
Each rank loads the same job payload and runs the trainer in-process; telemetry
to the job store is gated to rank 0 inside JobStoreSink, so the ranks never race.

Run indirectly:
    accelerate launch --num_processes N train_entry.py --config <payload.json>
"""
import argparse
import json
import os
import sys

# Ensure the backend root is importable regardless of how accelerate invokes us.
_BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_ROOT not in sys.path:
    sys.path.insert(0, _BACKEND_ROOT)


def main() -> None:
    parser = argparse.ArgumentParser(description="Finetune Lab multi-GPU training entry")
    parser.add_argument("--config", required=True, help="Path to the job payload JSON")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        payload = json.load(f)

    from workers.gpu_worker import execute_in_process
    from training.job_store_sink import JobStoreSink

    execute_in_process(payload, JobStoreSink(payload["run_id"]))


if __name__ == "__main__":
    main()
