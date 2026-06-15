import gc
import torch

def clear():
    gc.collect()
    torch.cuda.empty_cache()

def safe_train(trainer):
    try:
        trainer.train()
    except torch.cuda.OutOfMemoryError:
        clear()
        raise RuntimeError("CUDA OOM")
