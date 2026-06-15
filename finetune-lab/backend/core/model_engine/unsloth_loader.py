try:
    from unsloth import FastLanguageModel
except ImportError:
    FastLanguageModel = None


class UnslothModelLoader:

    def __init__(self, model_name: str):
        self.model_name = model_name

    def load(
        self,
        config
    ):
        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.model_name,
            max_seq_length=config.max_seq_length,
            dtype=None,
            load_in_4bit=config.load_in_4bit,
        )

        if config.training_type in ["lora", "qlora"]:
            model = FastLanguageModel.get_peft_model(
                model,
                r=config.lora_rank,
                target_modules=config.target_modules,
                lora_alpha=config.lora_alpha,
                lora_dropout=config.lora_dropout,
                bias="none",
                use_gradient_checkpointing="unsloth",
                random_state=3407,
                use_rslora=config.use_rslora,
                loftq_config=None if not config.use_loftq else config.use_loftq,
            )

        return model, tokenizer
