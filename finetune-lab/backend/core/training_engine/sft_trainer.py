from trl import SFTTrainer
from transformers import TrainingArguments

from .base_trainer import BaseTrainer
from ..model_engine.factory import ModelFactory
from ..dataset_engine.formatter import DatasetFormatter
import time
from job_engine.job_store import update_job


class SFTTrainerEngine(BaseTrainer):

    def prepare(self):

        loader = ModelFactory.load(self.model_name)

        self.model, self.tokenizer = loader.load()

        self.dataset = DatasetFormatter.load_jsonl(
            self.dataset_path
        )

    def train(self):
        # Simulated Progress Updates (IMPORTANT)
        for i in range(100):
            time.sleep(1)
            
            update_job(
                self.config["job_id"],
                {
                    "progress": i,
                    "loss": round(3.2 - i * 0.02, 4)
                }
            )

    def save(self):
        # Simulated saving
        pass

    def export(self):
        pass
