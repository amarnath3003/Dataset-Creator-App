from trl import SFTTrainer
from datasets import load_dataset
from core.training_engine.base.base_trainer import BaseTrainer
from core.training_engine.loaders.model_loader import ModelLoader
from core.training_engine.callbacks.streaming_callback import StreamingCallback

class CPTTrainer(BaseTrainer):

    def load_model(self):
        self.model, self.tokenizer = ModelLoader.load(self.config)

    def load_dataset(self):
        self.dataset = load_dataset(
            "json",
            data_files=self.config.dataset_path
        )["train"]

    def build_trainer(self):
        self.trainer = SFTTrainer(
            model=self.model,
            train_dataset=self.dataset,
            dataset_text_field="text",
            callbacks=[
                StreamingCallback(self.sink)
            ]
        )

    def run(self):
        self.trainer.train()
