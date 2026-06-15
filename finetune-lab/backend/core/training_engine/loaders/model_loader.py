from unsloth import FastLanguageModel

class ModelLoader:

    @staticmethod
    def load(config):

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=config.model_name,
            max_seq_length=config.max_seq_length,
            load_in_4bit=config.load_in_4bit
        )

        # adapter modes
        if config.training_type in [
            "sft",
            "lora",
            "qlora"
        ]:
            model = FastLanguageModel.get_peft_model(
                model,
                r=config.lora_rank,
                lora_alpha=config.lora_alpha,
                lora_dropout=config.lora_dropout,
                target_modules=config.target_modules,
                use_rslora=config.use_rslora,
                use_gradient_checkpointing="unsloth",
                random_state=3407,
                loftq_config=None if not config.use_loftq else {} # Requires loftq setup if true
            )

        # full finetuning
        if config.training_type == "full":
            for p in model.parameters():
                p.requires_grad = True

        return model, tokenizer
