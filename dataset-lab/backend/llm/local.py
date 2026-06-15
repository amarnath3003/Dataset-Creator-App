import requests
from typing import Dict, Any
from .base import LLMProvider


class LocalLLM(LLMProvider):
    def __init__(self, base_url: str = "http://localhost:11434"):
        self.base_url = base_url

    def generate(self, prompt: str, config: Dict[str, Any]) -> str:
        url = f"{self.base_url}/api/generate"

        # Extract config
        model = config.get("model_name", "llama3")
        temperature = config.get("temperature", 0.7)
        top_p = config.get("top_p", 1.0)

        # Ollama specific payload
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
            },
        }

        # Optional params
        if config.get("max_tokens"):
            payload["options"]["num_predict"] = config["max_tokens"]
        if config.get("frequency_penalty"):
            payload["options"]["frequency_penalty"] = config["frequency_penalty"]
        if config.get("presence_penalty"):
            payload["options"]["presence_penalty"] = config["presence_penalty"]

        try:
            response = requests.post(
                url, json=payload, timeout=300
            )  # 5 min timeout per chunk
            response.raise_for_status()
            data = response.json()
            return data.get("response", "")
        except requests.exceptions.Timeout:
            raise TimeoutError(
                f"Request to Local LLM at {url} timed out after 300 seconds."
            )
        except Exception as e:
            raise RuntimeError(f"Error calling Local LLM: {str(e)}")
