from accelerate import Accelerator

def setup():
    accelerator = Accelerator()
    return accelerator
