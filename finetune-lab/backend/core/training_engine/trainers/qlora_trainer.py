from core.training_engine.trainers.sft_trainer import SFTTrainerEngine

class QLoRATrainer(SFTTrainerEngine):
    def load_model(self):
        self.config.load_in_4bit = True
        super().load_model()
        
    def build_trainer(self):
        super().build_trainer()
        self.trainer.args.gradient_checkpointing = True
