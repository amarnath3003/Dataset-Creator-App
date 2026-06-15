from trl import SFTTrainer
from transformers import AutoProcessor
from core.training_engine.base.base_trainer import BaseTrainer
from core.training_engine.loaders.dataset_loader import DatasetLoader
from core.training_engine.callbacks.streaming_callback import StreamingCallback

class VisionTrainer(BaseTrainer):

    def load_model(self):
        # NOTE: Implement specific vision model loader
        self.model = None 
        self.processor = AutoProcessor.from_pretrained(
             self.config.model_name
        )
        self.tokenizer = self.processor.tokenizer if hasattr(self.processor, "tokenizer") else None

    def load_dataset(self):
        self.dataset = DatasetLoader.load(self.config.dataset_path, self.tokenizer)

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
