import re
import subprocess


REFERENCE_GPUS = [
    {"id": "ref-3060", "name": "NVIDIA RTX 3060 (Reference)", "vram_total": 12288, "is_reference": True},
    {"id": "ref-4070ti", "name": "NVIDIA RTX 4070 Ti Super (Reference)", "vram_total": 16384, "is_reference": True},
    {"id": "ref-4090", "name": "NVIDIA RTX 4090 (Reference)", "vram_total": 24576, "is_reference": True},
    {"id": "ref-a100", "name": "NVIDIA A100 40GB (Reference)", "vram_total": 40960, "is_reference": True},
    {"id": "ref-h100", "name": "NVIDIA H100 80GB (Reference)", "vram_total": 81920, "is_reference": True},
]


class GPUDetector:
    @staticmethod
    def get_reference_gpus():
        return list(REFERENCE_GPUS)

    @staticmethod
    def get_gpus():
        try:
            import torch

            if torch.cuda.is_available():
                gpus = []
                for i in range(torch.cuda.device_count()):
                    gpus.append({
                        "id": i,
                        "name": torch.cuda.get_device_name(i),
                        "vram_total": int(torch.cuda.get_device_properties(i).total_memory / (1024 * 1024)),
                        "is_reference": False,
                    })
                if gpus:
                    return gpus
        except Exception:
            pass

        # Fallback to nvidia-smi CLI when torch isn't installed or built without CUDA
        try:
            out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=index,name,memory.total", "--format=csv,noheader,nounits"],
                text=True,
                timeout=3,
            )
            gpus = []
            for line in out.strip().splitlines():
                parts = [p.strip() for p in line.split(",")]
                if len(parts) >= 3:
                    try:
                        gpus.append({
                            "id": int(parts[0]),
                            "name": parts[1],
                            "vram_total": int(float(parts[2])),
                            "is_reference": False,
                        })
                    except ValueError:
                        continue
            if gpus:
                return gpus
        except Exception:
            pass

        return []


class Estimator:
    @staticmethod
    def extract_params_billions(model_name: str) -> float:
        # e.g., 'gemma-2b', 'llama-3-8b', 'qwen1.5-14b'
        match = re.search(r"([\d\.]+)[bB]", model_name.lower())
        if match:
            return float(match.group(1))
        # Default to 7B if unknown
        return 7.0

    @staticmethod
    def estimate_vram(
        model_name: str,
        dataset_size: int,
        training_method: str,
        batch_size: int = 2,
        seq_length: int = 2048,
        lora_rank: int = 16,
        epochs: float = 3,
        grad_accum: int = 4,
        gpu_vram_gb: float = 24.0,
    ):
        method = (training_method or "qlora").lower()
        params_b = Estimator.extract_params_billions(model_name)
        dataset_size = max(1, int(dataset_size or 1000))
        batch_size = max(1, int(batch_size or 2))
        seq_length = max(128, int(seq_length or 2048))
        lora_rank = max(1, int(lora_rank or 16))
        epochs = max(0.1, float(epochs or 3))
        gpu_vram_gb = max(1.0, float(gpu_vram_gb or 24.0))

        # 1. Base model weights memory (GB)
        if method in ("qlora", "sft", "cpt", "vision"):
            bytes_per_param = 0.65  # 4-bit NF4 + quantization state
        elif method == "lora":
            bytes_per_param = 2.05  # bf16/fp16
        else:
            bytes_per_param = 2.1   # Full 16-bit SFT

        weights_gb = params_b * bytes_per_param

        # 2. Adapter + Optimizer + Gradient states (GB)
        if method == "full":
            adapter_grad_gb = params_b * 10.0  # grads + AdamW states + master weights
        else:
            # Trainable LoRA parameters scale modestly with rank and model width
            adapter_grad_gb = 0.35 + (lora_rank / 16.0) * (params_b / 7.0) * 0.25

        # 3. Activations & KV cache overhead
        activations_gb = (seq_length / 1024.0) * batch_size * (params_b / 7.0) * 0.75 + 0.5

        total_vram_gb = weights_gb + adapter_grad_gb + activations_gb

        # 4. Time estimate based on rows, epochs, model size, and seq length
        speed_factor = 1.0 if method in ("qlora", "sft", "cpt") else (1.2 if method == "lora" else 2.0)
        seq_factor = max(0.5, seq_length / 2048.0)
        estimated_time_hours = (dataset_size * epochs / 10000.0) * (params_b / 7.0) * speed_factor * seq_factor
        estimated_minutes = max(1, round(estimated_time_hours * 60))

        return {
            "weights_gb": round(weights_gb, 2),
            "adapter_grad_gb": round(adapter_grad_gb, 2),
            "activations_gb": round(activations_gb, 2),
            "estimated_vram_gb": round(total_vram_gb, 2),
            "estimated_time_hours": round(estimated_time_hours, 2),
            "estimated_minutes": estimated_minutes,
            "fits": bool(total_vram_gb <= gpu_vram_gb),
        }
