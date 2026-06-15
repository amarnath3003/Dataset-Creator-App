import logging
from langchain_text_splitters import RecursiveCharacterTextSplitter
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


class ChunkingEngine:
    def __init__(self):
        self.encoder = None
        try:
            import tiktoken

            self.encoder = tiktoken.get_encoding("cl100k_base")
        except ImportError:
            logger.warning(
                "[Chunking] tiktoken not installed. Falling back to char-length estimation."
            )

    def count_tokens(self, text: str) -> int:
        if self.encoder:
            try:
                return len(self.encoder.encode(text))
            except Exception:
                pass
        # Fallback heuristic: roughly 4 characters per token
        return max(1, len(text) // 4)

    def chunk(
        self, text: str, chunk_size: int = 800, chunk_overlap: int = 100
    ) -> List[Dict[str, Any]]:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            length_function=self.count_tokens,
            separators=["\n\n", "\n", " ", ""],
        )

        splits = splitter.split_text(text)

        chunks = []
        for i, split_text in enumerate(splits):
            chunks.append(
                {
                    "chunk_id": i,
                    "text": split_text,
                    "token_count": self.count_tokens(split_text),
                }
            )

        return chunks


chunking_engine = ChunkingEngine()
