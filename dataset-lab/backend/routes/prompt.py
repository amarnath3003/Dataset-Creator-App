from fastapi import APIRouter, HTTPException
from pathlib import Path
from backend.models import PromptUpdateRequest

router = APIRouter()

PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "base_prompt.txt"


@router.get("/")
def get_prompt():
    """Read the current base_prompt.txt"""
    if not PROMPT_FILE.exists():
        # Create default if missing
        PROMPT_FILE.parent.mkdir(parents=True, exist_ok=True)
        default_prompt = (
            "Context Domain: {domain}.\n\n"
            "You are a helpful assistant that generates Question-Answer pairs from text.\n"
            "Please create exactly {qa_count} high-quality QA pairs based on the following text chunk.\n\n"
            "Text Chunk:\n{chunk}\n\n"
            "Instructions:\n"
            "1. Cover important facts in the chunk.\n"
            "2. Behave like a normal helpful LLM.\n"
            "3. You may expand slightly for clarity, but stick to the facts in the text.\n"
            "4. Output MUST be a valid JSON list of objects strictly following this structure:\n"
            '[\n  {{"question": "The generated question", "answer": "The generated answer"}}\n]\n'
            "5. Do not include any explanation, only the raw JSON list.\n"
        )
        PROMPT_FILE.write_text(default_prompt, encoding="utf-8")

    try:
        content = PROMPT_FILE.read_text(encoding="utf-8")
        return {"prompt": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read prompt: {str(e)}")


@router.post("/")
def update_prompt(request: PromptUpdateRequest):
    """Overwrite base_prompt.txt with new content"""
    try:
        PROMPT_FILE.parent.mkdir(parents=True, exist_ok=True)
        PROMPT_FILE.write_text(request.prompt, encoding="utf-8")
        return {"message": "Prompt updated successfully"}
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to update prompt: {str(e)}"
        )
