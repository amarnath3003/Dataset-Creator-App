def export(model, tokenizer):
    model.save_pretrained_gguf(
        "gguf_model",
        tokenizer
    )
