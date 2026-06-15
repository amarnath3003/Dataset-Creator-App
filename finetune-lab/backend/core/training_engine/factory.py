from .sft_trainer import SFTTrainerEngine
from .lora_trainer import LoRATrainer
from .qlora_trainer import QLoRATrainer


class TrainerFactory:

    @staticmethod
    def create(
        training_type,
        model_name,
        dataset_path,
        config
    ):

        trainers = {
            "sft": SFTTrainerEngine,
            "lora": LoRATrainer,
            "qlora": QLoRATrainer
        }

        trainer_class = trainers[training_type]

        return trainer_class(
            model_name,
            dataset_path,
            config
        )
