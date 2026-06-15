from trl import SFTTrainer
from transformers import AutoProcessor
from datasets import load_dataset
from core.training_engine.base.base_trainer import BaseTrainer
from core.training_engine.callbacks.streaming_callback import StreamingCallback

class VisionTrainer(BaseTrainer):

    def load_model(self):
        # NOTE: Implement specific vision model loader
        self.model = None 
        self.processor = AutoProcessor.from_pretrained(
             self.config.model_name
        )

    def load_dataset(self):
        self.dataset = load_dataset(
            "json",
            data_files=self.config.dataset_path
        )["train"]

    def build_trainer(self):
        self.trainer = SFTTrainer(
            model=self.model,
            train_dataset=self.dataset,
            callbacks=[
                StreamingCallback(self.sink)
            ]
        )

    def run(self):
        self.trainer.train()
