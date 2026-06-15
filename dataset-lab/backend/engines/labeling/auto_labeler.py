import json
import logging
import asyncio
import re
from typing import Dict, Any, List, Optional

from backend.llm.local import LocalLLM

logger = logging.getLogger(__name__)


async def auto_label_content(
    text: str, current_labels: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Given a piece of scraped text, uses the configured LLM engine
    to extract labels, categories, metadata, and language.
    """
    if not current_labels:
        current_labels = []

    prompt = f"""
    Analyze the following text and extract relevant metadata.
    Return ONLY a valid JSON object with the following schema:
    {{
        "suggested_labels": ["label1", "label2"],
        "category": "Main Category",
        "language": "en/es/fr/etc",
        "summary": "1-2 sentence summary"
    }}

    Existing labels used in this project: {current_labels}

    Text snippet:
    {text[:2000]}
    """

    try:
        llm = LocalLLM()
        # Ensure we provide a default mock config required by LocalLLM
        dummy_config = {
            "model_name": "llama3.2:1b",  # fast default model
            "temperature": 0.3,
            "max_tokens": 200,
        }

        # Run synchronous LLM inference block asynchronously
        # LocalLLM.generate signature is (prompt, config), no system_prompt kwarg
        full_prompt = f"System: You are an expert data taxonomist. Output ONLY strictly valid JSON without markdown blocks.\n\n{prompt}"
        response = await asyncio.to_thread(llm.generate, full_prompt, dummy_config)

        # Try parse clean JSON
        try:
            parsed = json.loads(response.strip())
            return parsed
        except json.JSONDecodeError:
            # Fallback regex scrape
            json_match = re.search(r"\{.*\}", response, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            raise ValueError("No JSON object could be extracted.")

    except Exception as e:
        logger.error(f"Error auto-labeling content: {e}")
        # Return fallback on catastrophic failure
        return {
            "suggested_labels": ["scraped", "fallback"],
            "category": "Uncategorized",
            "language": "en",
            "summary": text[:100] + "...",
        }


async def correct_image_caption(caption: str, context: str) -> str:
    """
    Uses LLM to improve and correct a scraped image caption.
    """
    if not caption and not context:
        return "Untitled Image"

    # Placeholder
    return caption or "Extracted Image"
