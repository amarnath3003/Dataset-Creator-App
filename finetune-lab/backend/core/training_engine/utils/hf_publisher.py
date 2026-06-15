def push(model, tokenizer, repo):
    model.push_to_hub(repo)
    tokenizer.push_to_hub(repo)
