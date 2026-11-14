import os
from typing import Dict, Any
import requests
from .base import LLMProvider


class OpenAILLM(LLMProvider):
    def __init__(self):
        self._env_api_key = os.getenv("OPENAI_API_KEY")

    def generate(self, prompt: str, config: Dict[str, Any]) -> str:
        api_key = config.get("api_key") or self._env_api_key
        base_url = (
            config.get("base_url")
            or os.getenv("OPENAI_BASE_URL")
            or "https://api.openai.com/v1"
        ).rstrip("/")

        if not api_key and "api.openai.com" in base_url:
            raise RuntimeError(
                "OpenAI API key not provided. Set it in Settings or add OPENAI_API_KEY to your .env file."
            )

        url = f"{base_url}/chat/completions"
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        temperature = config.get("temperature", 0.7)
        top_p = config.get("top_p", 1.0)

        payload: Dict[str, Any] = {
            "model": config.get("model_name", "gpt-4o-mini"),
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "top_p": top_p,
        }

        if config.get("max_tokens"):
            payload["max_tokens"] = config["max_tokens"]
        if config.get("frequency_penalty"):
            payload["frequency_penalty"] = config["frequency_penalty"]
        if config.get("presence_penalty"):
            payload["presence_penalty"] = config["presence_penalty"]

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=300)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            raise RuntimeError(f"Error calling OpenAI-compatible API ({base_url}): {e}")
