from transformers import TrainerCallback

class StreamingCallback(TrainerCallback):

    def __init__(self, sink):
        self.sink = sink

    def on_log(self, args, state, control, logs=None, **kwargs):
        self.sink.emit({
            "step": state.global_step,
            "epoch": state.epoch,
            "loss": logs.get("loss")
        })
