from .lora_trainer import LoRATrainer


class QLoRATrainer(LoRATrainer):

    def prepare(self):

        loader = self.model_loader = None

        super().prepare()
