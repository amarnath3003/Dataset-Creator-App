from abc import ABC, abstractmethod
from typing import Dict, Any


class LLMProvider(ABC):
    @abstractmethod
    def generate(self, prompt: str, config: Dict[str, Any]) -> str:
        """
        Generate text from the LLM based on prompt and configuration.
        config may contain: model_name, temperature, max_tokens, top_p, etc.
        """
