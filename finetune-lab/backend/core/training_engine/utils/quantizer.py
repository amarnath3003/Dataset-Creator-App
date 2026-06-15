def quantize(model, tokenizer, method="q4_k_m"):
    model.save_pretrained_gguf(
        "quantized",
        tokenizer,
        quantization_method=method
    )
