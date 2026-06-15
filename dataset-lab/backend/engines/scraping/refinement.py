import aiohttp
import logging

logger = logging.getLogger(__name__)


async def refine_text_with_llm(
    raw_text: str,
    provider: str = "local",
    model_name: str = "llama3.2",
    api_key: str = "",
    system_prompt: str = "",
) -> str:
    """
    Sends heuristically cleaned text to the LLM to be stripped of noise
    and formatted cleanly into markdown.
    Includes safety rails for context limits and network failures.
    """
    if not raw_text or len(raw_text.strip()) == 0:
        return raw_text

    # Safety Check 1: Truncate to avoid context window explosion
    # 20,000 characters is roughly ~5000 tokens, well within local 8B models' limits
    max_chars = 20000
    truncated_text = raw_text[:max_chars]
    if len(raw_text) > max_chars:
        logger.warning(
            f"Text truncated from {len(raw_text)} to {max_chars} chars for LLM refinement."
        )

    if not system_prompt or not system_prompt.strip():
        system_prompt = (
            "You are an expert dataset curator. Your task is to clean and refine the following web scraped text. "
            "Remove all navigational noise, ad fragments, cookie warnings, and broken formatting. "
            "Keep the factual content pristine and output it as well-structured markdown. "
            "Do not invent or add any new information. Output ONLY the cleaned text."
        )

    try:
        async with aiohttp.ClientSession() as session:
            if provider == "openai":
                if not api_key:
                    logger.error("OpenAI API key missing for refinement.")
                    return raw_text

                async with session.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_name or "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": truncated_text},
                        ],
                        "temperature": 0.1,
                    },
                    timeout=120,
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        response_text = (
                            data.get("choices", [{}])[0]
                            .get("message", {})
                            .get("content", "")
                            .strip()
                        )
                        if response_text:
                            return response_text
                    else:
                        logger.error(
                            f"OpenAI refinement failed with status {response.status}: {await response.text()}"
                        )
            else:
                # Default to Ollama local structure
                async with session.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": model_name or "llama3.2",
                        "system": system_prompt,
                        "prompt": truncated_text,
                        "stream": False,
                        "options": {"temperature": 0.1},
                    },
                    timeout=120,
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        response_text = data.get("response", "").strip()
                        if response_text:
                            return response_text
                    else:
                        logger.error(
                            f"Ollama refinement failed with status {response.status}"
                        )
    except Exception as e:
        logger.error(f"Error during LLM refinement connection: {e}")

    # Safety Check 2: Fallback to original text if LLM fails
    logger.info("Falling back to unrefined heuristic text due to LLM failure.")
    return raw_text
