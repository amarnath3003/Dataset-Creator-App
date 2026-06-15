from core.training_engine.trainers.sft_trainer import SFTTrainerEngine

class QLoRATrainer(SFTTrainerEngine):
    def build_trainer(self):
        self.config.load_in_4bit = True
        super().build_trainer()
        self.trainer.args.gradient_checkpointing = True
