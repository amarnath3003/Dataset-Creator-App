import re
import torch

class GPUDetector:
    @staticmethod
    def get_gpus():
        if not torch.cuda.is_available():
            return [{"id": 0, "name": "CPU Only", "vram_total": 0}]
        
        gpus = []
        for i in range(torch.cuda.device_count()):
            gpus.append({
                "id": i,
                "name": torch.cuda.get_device_name(i),
                "vram_total": int(torch.cuda.get_device_properties(i).total_memory / (1024 * 1024))
            })
        return gpus

class Estimator:
    @staticmethod
    def extract_params_billions(model_name: str) -> float:
        # e.g., 'gemma-2b', 'llama-3-8b', 'qwen1.5-14b'
        match = re.search(r'([\d\.]+)[bB]', model_name.lower())
        if match:
            return float(match.group(1))
        # Default to 7B if unknown
        return 7.0

    @staticmethod
    def estimate_vram(model_name: str, dataset_size: int, training_method: str, batch_size: int = 2, seq_length: int = 2048):
        # 1. Get parameter count
        params_b = Estimator.extract_params_billions(model_name)
        
        # 2. Base model memory
        if training_method == "qlora":
            bytes_per_param = 0.7  # 4-bit + overhead
        elif training_method == "lora":
            bytes_per_param = 2.2  # 16-bit
        else:
            bytes_per_param = 2.2  # SFT
            
        base_vram_gb = params_b * bytes_per_param
        
        # 3. Optimizer & Gradients
        if training_method in ["qlora", "lora"]:
            # LoRA ranks usually small, optim states are tiny relative to full model
            optim_vram_gb = 0.5 
        else:
            # Full finetuning requires 8-12 bytes per param
            optim_vram_gb = params_b * 12.0
            
        # 4. Activations (rough heuristic: scales with batch * seq_len * layers)
        # Using a generalized heuristic for typical models (assuming 7B has ~32 layers)
        activation_vram_gb = (seq_length / 1024) * (batch_size) * (params_b / 7.0) * 0.8
        
        total_vram_gb = base_vram_gb + optim_vram_gb + activation_vram_gb
        
        # 5. Estimate time (rough heuristic based on dataset size and model size)
        # Assuming an RTX 3090/4090 baseline where 7B takes ~1 hour per 10k examples in QLoRA
        speed_factor = 1.0 if training_method == "qlora" else 1.2
        estimated_time_hours = (dataset_size / 10000) * (params_b / 7.0) * speed_factor

        return {
            "estimated_vram_gb": round(total_vram_gb, 2),
            "estimated_time_hours": round(estimated_time_hours, 2)
        }
