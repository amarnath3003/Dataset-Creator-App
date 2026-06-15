from datasets import load_dataset, Dataset
from core.dataset_engine.detector import DatasetDetector, DatasetFormat
from core.dataset_engine.formatter import DatasetFormatter

class DatasetLoader:
    
    @staticmethod
    def load(dataset_path: str, tokenizer=None):
        # 1. Load raw
        if dataset_path.endswith(".json") or dataset_path.endswith(".jsonl"):
            raw_dataset = load_dataset("json", data_files=dataset_path)["train"]
        elif dataset_path.endswith(".csv"):
            raw_dataset = load_dataset("csv", data_files=dataset_path)["train"]
        elif dataset_path.endswith(".parquet"):
            raw_dataset = load_dataset("parquet", data_files=dataset_path)["train"]
        else:
            # Try loading as huggingface hub dataset
            raw_dataset = load_dataset(dataset_path)["train"]
            
        # 2. Detect format
        columns = raw_dataset.column_names
        fmt = DatasetDetector.detect(columns)
        
        # 3. Format dataset into standard SFT structure
        formatted_dataset = DatasetFormatter.format_dataset(raw_dataset, fmt, tokenizer)
        
        return formatted_dataset
