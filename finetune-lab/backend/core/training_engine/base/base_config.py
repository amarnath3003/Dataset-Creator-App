from pydantic import BaseModel
from typing import Literal, Optional

class TrainingConfig(BaseModel):
    run_id: str
    training_type: Literal[
        "sft",
        "lora",
        "qlora",
        "full",
        "cpt",
        "vision"
    ]
    model_name: str
    dataset_path: str
    output_dir: str
    max_seq_length: int = 2048
    learning_rate: float = 2e-4
    batch_size: int = 2
    gradient_accumulation: int = 4
    epochs: int = 3
    save_steps: int = 200
    load_in_4bit: bool = True
    multi_gpu: bool = False
    num_gpus: int = 1
    resume_checkpoint: Optional[str] = None
    push_to_hub: bool = False
    hf_repo: Optional[str] = None

    # LoRA / QLoRA only
    lora_rank: int = 16
    lora_alpha: int = 16
    lora_dropout: float = 0
    use_rslora: bool = False
    use_loftq: bool = False
    target_modules: list = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]

    # SFT / CPT
    packing: bool = False

    # export
    export_gguf: bool = False
    quantize: bool = False
