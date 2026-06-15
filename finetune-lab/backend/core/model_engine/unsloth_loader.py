from unsloth import FastLanguageModel


class UnslothModelLoader:

    def __init__(self, model_name: str):
        self.model_name = model_name

    def load(
        self,
        max_seq_length=2048,
        dtype=None,
        load_in_4bit=True
    ):

        model, tokenizer = FastLanguageModel.from_pretrained(
            model_name=self.model_name,
            max_seq_length=max_seq_length,
            dtype=dtype,
            load_in_4bit=load_in_4bit,
        )

        return model, tokenizer
