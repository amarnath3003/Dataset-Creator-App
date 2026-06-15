import tiktoken
from sentence_transformers import SentenceTransformer, util
from typing import List, Dict, Any


class EmbeddingRefiner:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        # Initialize model
        # This will download the model if not present, which might take time on first run
        self.model = SentenceTransformer(model_name)
        self.encoder = tiktoken.get_encoding("cl100k_base")

    def refine(
        self, chunks: List[Dict[str, Any]], threshold: float = 0.92
    ) -> List[Dict[str, Any]]:
        """
        Merge adjacent chunks if their cosine similarity is above the threshold.
        """
        if not chunks:
            return []

        refined_chunks = []

        # Initialize buffer with the first chunk
        buffer_chunk = chunks[0].copy()

        # We need to maintain the buffer's embedding
        buffer_emb = self.model.encode(buffer_chunk["text"], convert_to_tensor=True)

        i = 1
        while i < len(chunks):
            next_chunk = chunks[i]
            next_emb = self.model.encode(next_chunk["text"], convert_to_tensor=True)

            # Compute cosine similarity
            sim = util.pytorch_cos_sim(buffer_emb, next_emb).item()

            if sim > threshold:
                # Merge: Append next chunk text to buffer
                buffer_chunk["text"] += " " + next_chunk["text"]
                # Re-compute buffer embedding (merging changes meaning)
                buffer_emb = self.model.encode(
                    buffer_chunk["text"], convert_to_tensor=True
                )
            else:
                # No merge: Commit buffer and start new buffer
                refined_chunks.append(buffer_chunk)
                buffer_chunk = next_chunk.copy()
                buffer_emb = next_emb

            i += 1

        # Append the last remaining buffer
        refined_chunks.append(buffer_chunk)

        # Final pass: Re-index and re-count tokens
        final_chunks = []
        for idx, c in enumerate(refined_chunks):
            c["chunk_id"] = idx
            c["token_count"] = len(self.encoder.encode(c["text"]))
            final_chunks.append(c)

        return final_chunks


embedding_refiner = EmbeddingRefiner()
