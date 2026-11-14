import logging
import math
import re
from collections import Counter
from typing import List, Dict, Any

logger = logging.getLogger(__name__)


def _fallback_cosine(text_a: str, text_b: str) -> float:
    va = Counter(re.findall(r"[a-z0-9]{2,}", text_a.lower()))
    vb = Counter(re.findall(r"[a-z0-9]{2,}", text_b.lower()))
    if not va or not vb:
        return 0.0
    common = set(va.keys()) & set(vb.keys())
    num = sum(va[k] * vb[k] for k in common)
    den = math.sqrt(sum(v * v for v in va.values())) * math.sqrt(sum(v * v for v in vb.values()))
    return (num / den) if den else 0.0


class EmbeddingRefiner:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model_name = model_name
        self._model = None
        self._model_failed = False
        self._encoder = None
        self._util = None

    def _get_encoder(self):
        if self._encoder is None:
            try:
                import tiktoken
                self._encoder = tiktoken.get_encoding("cl100k_base")
            except Exception:
                self._encoder = False
        return self._encoder if self._encoder else None

    def _count_tokens(self, text: str) -> int:
        enc = self._get_encoder()
        if enc:
            try:
                return len(enc.encode(text))
            except Exception:
                pass
        return max(1, len(text) // 4)

    def _get_model(self):
        if self._model is not None or self._model_failed:
            return self._model
        try:
            from sentence_transformers import SentenceTransformer, util
            self._model = SentenceTransformer(self.model_name)
            self._util = util
        except Exception as e:
            logger.warning(
                f"[EmbeddingRefiner] Could not load SentenceTransformer ({e}); using TF cosine fallback."
            )
            self._model_failed = True
            self._model = None
        return self._model

    def refine(
        self,
        chunks: List[Dict[str, Any]],
        threshold: float = 0.92,
        max_chunk_tokens: int = 1200,
    ) -> List[Dict[str, Any]]:
        """Merge adjacent chunks when cosine similarity > threshold AND combined tokens <= max_chunk_tokens."""
        if not chunks:
            return []

        model = self._get_model()
        refined_chunks = []

        buffer_chunk = chunks[0].copy()
        buffer_tokens = buffer_chunk.get("token_count") or self._count_tokens(buffer_chunk["text"])
        buffer_emb = (
            model.encode(buffer_chunk["text"], convert_to_tensor=True)
            if model is not None
            else None
        )

        for next_chunk in chunks[1:]:
            next_tokens = next_chunk.get("token_count") or self._count_tokens(next_chunk["text"])

            if buffer_tokens + next_tokens > max_chunk_tokens:
                refined_chunks.append(buffer_chunk)
                buffer_chunk = next_chunk.copy()
                buffer_tokens = next_tokens
                buffer_emb = (
                    model.encode(buffer_chunk["text"], convert_to_tensor=True)
                    if model is not None
                    else None
                )
                continue

            if model is not None and self._util is not None:
                next_emb = model.encode(next_chunk["text"], convert_to_tensor=True)
                sim = self._util.pytorch_cos_sim(buffer_emb, next_emb).item()
            else:
                next_emb = None
                sim = _fallback_cosine(buffer_chunk["text"], next_chunk["text"])

            if sim > threshold:
                buffer_chunk["text"] += "\n\n" + next_chunk["text"]
                buffer_tokens = self._count_tokens(buffer_chunk["text"])
                if model is not None:
                    buffer_emb = model.encode(buffer_chunk["text"], convert_to_tensor=True)
            else:
                refined_chunks.append(buffer_chunk)
                buffer_chunk = next_chunk.copy()
                buffer_tokens = next_tokens
                buffer_emb = next_emb

        refined_chunks.append(buffer_chunk)

        final_chunks = []
        for idx, c in enumerate(refined_chunks):
            c["chunk_id"] = idx
            c["token_count"] = self._count_tokens(c["text"])
            final_chunks.append(c)

        return final_chunks


embedding_refiner = EmbeddingRefiner()
