import os
from typing import Dict, Any
import requests
from .base import LLMProvider


class AnthropicLLM(LLMProvider):
    def __init__(self):
        self._env_api_key = os.getenv("ANTHROPIC_API_KEY")

    def generate(self, prompt: str, config: Dict[str, Any]) -> str:
        api_key = config.get("api_key") or self._env_api_key
        if not api_key:
            raise RuntimeError(
                "Anthropic API key not provided. Set it in Settings or add ANTHROPIC_API_KEY to your .env file."
            )

        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

        max_tokens = config.get("max_tokens") or 2048
        payload: Dict[str, Any] = {
            "model": config.get("model_name") or "claude-3-5-sonnet-latest",
            "max_tokens": max_tokens,
            "temperature": min(1.0, float(config.get("temperature", 0.7))),
            "messages": [{"role": "user", "content": prompt}],
        }

        try:
            response = requests.post(url, headers=headers, json=payload, timeout=300)
            response.raise_for_status()
            data = response.json()
            blocks = data.get("content", [])
            return "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        except Exception as e:
            raise RuntimeError(f"Error calling Anthropic API: {e}")
