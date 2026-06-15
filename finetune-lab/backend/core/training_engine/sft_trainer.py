from trl import SFTTrainer
from transformers import TrainingArguments

from .base_trainer import BaseTrainer
from ..model_engine.factory import ModelFactory
from ..dataset_engine.formatter import DatasetFormatter


class SFTTrainerEngine(BaseTrainer):

    def prepare(self):

        loader = ModelFactory.load(self.model_name)

        self.model, self.tokenizer = loader.load()

        self.dataset = DatasetFormatter.load_jsonl(
            self.dataset_path
        )

    def train(self):

        trainer = SFTTrainer(
            model=self.model,
            tokenizer=self.tokenizer,
            train_dataset=self.dataset,
            dataset_text_field="text",
            args=TrainingArguments(
                output_dir="outputs",
                per_device_train_batch_size=self.config["batch_size"],
                learning_rate=self.config["learning_rate"],
                num_train_epochs=self.config["epochs"],
            )
        )

        trainer.train()

    def save(self):

        self.model.save_pretrained(
            "outputs/final"
        )

    def export(self):
        pass
