from core.training_engine.trainers.sft_trainer import SFTTrainerEngine
from core.training_engine.trainers.lora_trainer import LoRATrainer
from core.training_engine.trainers.qlora_trainer import QLoRATrainer
from core.training_engine.trainers.full_trainer import FullFinetuner
from core.training_engine.trainers.cpt_trainer import CPTTrainer
from core.training_engine.trainers.vision_trainer import VisionTrainer

class TrainerFactory:

    @staticmethod
    def create(config, sink):
        mapping = {
            "sft": SFTTrainerEngine,
            "lora": LoRATrainer,
            "qlora": QLoRATrainer,
            "full": FullFinetuner,
            "cpt": CPTTrainer,
            "vision": VisionTrainer
        }

        return mapping[config.training_type](config, sink)
