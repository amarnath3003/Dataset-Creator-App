from trl import SFTTrainer
from core.training_engine.base.base_trainer import BaseTrainer
from core.training_engine.loaders.model_loader import ModelLoader
from core.training_engine.loaders.dataset_loader import DatasetLoader
from core.training_engine.callbacks.streaming_callback import StreamingCallback

class SFTTrainerEngine(BaseTrainer):

    def load_model(self):
        self.model, self.tokenizer = ModelLoader.load(self.config)

    def load_dataset(self):
        self.dataset = DatasetLoader.load(self.config.dataset_path, self.tokenizer)

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
