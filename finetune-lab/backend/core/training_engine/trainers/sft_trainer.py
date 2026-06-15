try:
    from trl import SFTTrainer
    from transformers import TrainingArguments
except ImportError:
    SFTTrainer = None
    TrainingArguments = None

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
        args = TrainingArguments(
            output_dir=self.config.output_dir,
            per_device_train_batch_size=self.config.batch_size,
            gradient_accumulation_steps=self.config.gradient_accumulation,
            learning_rate=self.config.learning_rate,
            num_train_epochs=self.config.epochs,
            save_steps=self.config.save_steps,
            logging_steps=1,
            fp16=not self.model.name_or_path.endswith("bf16"),
            bf16=self.model.name_or_path.endswith("bf16"),
            optim="adamw_8bit",
            weight_decay=0.01,
            lr_scheduler_type="linear",
            seed=3407,
            report_to="none"
        )

        self.trainer = SFTTrainer(
            model=self.model,
            train_dataset=self.dataset,
            dataset_text_field="text",
            packing=self.config.packing,
            max_seq_length=self.config.max_seq_length,
            args=args,
            callbacks=[
                StreamingCallback(self.sink)
            ]
        )

    def run(self):
        self.trainer.train(resume_from_checkpoint=self.config.resume_checkpoint)

