import requests
import os
from typing import Dict, Any
from .base import LLMProvider


class OpenAILLM(LLMProvider):
    def __init__(self):
        self._env_api_key = os.getenv("OPENAI_API_KEY")

    def generate(self, prompt: str, config: Dict[str, Any]) -> str:
        # Prefer frontend-supplied key, then fall back to environment variable
        api_key = config.get("api_key") or self._env_api_key
        if not api_key:
            raise RuntimeError(
                "OpenAI API key not provided. Set it in Settings or add OPENAI_API_KEY to your .env file."
            )

        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        temperature = config.get("temperature", 0.7)
        top_p = config.get("top_p", 1.0)

        payload = {
            "model": config.get("model_name", "gpt-4-turbo"),
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
            # 5-minute timeout (300 seconds) to prevent infinite thread pool blocking
            response = requests.post(url, headers=headers, json=payload, timeout=300)
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            return f"Error calling OpenAI: {str(e)}"
