from enum import Enum
from typing import List, Dict

class DatasetFormat(Enum):
    INSTRUCTION = "instruction" # instruction, input, output
    CHATML = "chatml"           # messages: [{role, content}]
    SHAREGPT = "sharegpt"       # conversations: [{from, value}]
    PREFERENCE = "preference"   # prompt, chosen, rejected
    COMPLETION = "completion"   # text
    UNKNOWN = "unknown"

class DatasetDetector:
    
    @staticmethod
    def detect(columns: List[str]) -> DatasetFormat:
        cols = set(columns)
        
        # Check for standard instruction format
        if "instruction" in cols and "output" in cols:
            return DatasetFormat.INSTRUCTION
            
        # Check for ChatML
        if "messages" in cols:
            return DatasetFormat.CHATML
            
        # Check for ShareGPT
        if "conversations" in cols:
            return DatasetFormat.SHAREGPT
            
        # Check for DPO/Preference
        if "prompt" in cols and "chosen" in cols and "rejected" in cols:
            return DatasetFormat.PREFERENCE
            
        # Check for raw completion
        if "text" in cols:
            return DatasetFormat.COMPLETION
            
        return DatasetFormat.UNKNOWN
