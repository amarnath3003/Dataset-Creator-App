from trl import SFTTrainer
from unsloth import FastLanguageModel
from core.training_engine.base.base_trainer import BaseTrainer
from core.training_engine.callbacks.streaming_callback import StreamingCallback
from core.training_engine.loaders.dataset_loader import DatasetLoader

class FullFinetuner(BaseTrainer):

    def load_model(self):
        self.model, self.tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.config.model_name,
            load_in_4bit=False
        )
        # no adapter wrapping
        for p in self.model.parameters():
            p.requires_grad = True

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
