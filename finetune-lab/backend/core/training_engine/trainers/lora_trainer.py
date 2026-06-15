from core.training_engine.trainers.sft_trainer import SFTTrainerEngine

class LoRATrainer(SFTTrainerEngine):
    def load_model(self):
        self.config.load_in_4bit = False
        super().load_model()
