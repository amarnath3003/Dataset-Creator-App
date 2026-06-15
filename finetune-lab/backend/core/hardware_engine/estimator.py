class GPUDetector:
    @staticmethod
    def get_gpus():
        # Mock detector
        return [{"id": 0, "name": "Mock RTX 3090", "vram_total": 24000}]

class Estimator:
    @staticmethod
    def estimate_vram(model_name, dataset_size, training_method):
        return {"estimated_vram": 10.5, "estimated_time_hours": 2.5}
