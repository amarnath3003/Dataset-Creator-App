import time
import torch
from transformers import TrainerCallback

class StreamingCallback(TrainerCallback):

    def __init__(self, sink):
        self.sink = sink
        self.start_time = None

    def on_train_begin(self, args, state, control, **kwargs):
        self.start_time = time.time()

    def on_log(self, args, state, control, logs=None, **kwargs):
        if logs is None:
            return

        elapsed = time.time() - self.start_time if self.start_time else 0
        eta = 0
        if state.global_step > 0 and state.max_steps > 0:
            steps_remaining = state.max_steps - state.global_step
            time_per_step = elapsed / state.global_step
            eta = steps_remaining * time_per_step

        vram_mb = 0
        if torch.cuda.is_available():
            vram_mb = torch.cuda.max_memory_allocated() / (1024 * 1024)

        self.sink.emit({
            "step": state.global_step,
            "max_steps": state.max_steps,
            "epoch": round(state.epoch or 0, 2),
            "loss": logs.get("loss"),
            "learning_rate": logs.get("learning_rate"),
            "eta_seconds": round(eta),
            "vram_mb": round(vram_mb)
        })
