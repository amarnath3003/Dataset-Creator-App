from unsloth import FastLanguageModel

from .sft_trainer import SFTTrainerEngine


class LoRATrainer(SFTTrainerEngine):

    def prepare(self):

        super().prepare()

        self.model = FastLanguageModel.get_peft_model(
            self.model,
            r=self.config["rank"],
            lora_alpha=self.config["alpha"],
            lora_dropout=self.config["dropout"],
            target_modules=[
                "q_proj",
                "k_proj",
                "v_proj",
                "o_proj",
            ]
        )
