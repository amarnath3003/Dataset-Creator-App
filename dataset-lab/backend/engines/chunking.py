import logging
import math
import re
from collections import Counter
from typing import List, Dict, Any

from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)


def _cosine_text_sim(a: str, b: str) -> float:
    va = Counter(re.findall(r"[a-z0-9]{2,}", a.lower()))
    vb = Counter(re.findall(r"[a-z0-9]{2,}", b.lower()))
    if not va or not vb:
        return 0.0
    common = set(va.keys()) & set(vb.keys())
    num = sum(va[k] * vb[k] for k in common)
    den = math.sqrt(sum(v * v for v in va.values())) * math.sqrt(sum(v * v for v in vb.values()))
    return (num / den) if den else 0.0


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
        if not text:
            return 0
        if self.encoder:
            try:
                return len(self.encoder.encode(text))
            except Exception:
                pass
        return max(1, len(text) // 4)

    def _split_recursive(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        overlap = min(chunk_overlap, max(0, chunk_size - 50))
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            length_function=self.count_tokens,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        return splitter.split_text(text)

    def _split_sentences_preserving_code(self, text: str) -> List[str]:
        blocks = re.split(r"(```[\s\S]*?```)", text)
        units: List[str] = []
        for block in blocks:
            if not block or not block.strip():
                continue
            if block.startswith("```"):
                units.append(block.strip())
                continue
            for para in re.split(r"\n{2,}", block):
                para = para.strip()
                if not para:
                    continue
                if re.match(r"^#{1,6}\s", para) or "\n| " in para:
                    units.append(para)
                else:
                    sents = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9#\"'(\[])", para)
                    units.extend(s.strip() for s in sents if s.strip())
        return units

    def _split_sentence_window(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        units = self._split_sentences_preserving_code(text)
        if not units:
            return self._split_recursive(text, chunk_size, chunk_overlap)

        chunks: List[str] = []
        current: List[str] = []
        current_tokens = 0

        for unit in units:
            u_tok = self.count_tokens(unit)
            if u_tok > chunk_size:
                if current:
                    chunks.append("\n".join(current))
                    current = []
                    current_tokens = 0
                chunks.extend(self._split_recursive(unit, chunk_size, chunk_overlap))
                continue

            if current and current_tokens + u_tok > chunk_size:
                chunks.append("\n".join(current))
                # Overlap trailing units up to chunk_overlap
                overlap_units: List[str] = []
                overlap_tok = 0
                for prev in reversed(current):
                    pt = self.count_tokens(prev)
                    if overlap_tok + pt <= chunk_overlap:
                        overlap_units.insert(0, prev)
                        overlap_tok += pt
                    else:
                        break
                current = overlap_units
                current_tokens = overlap_tok

            current.append(unit)
            current_tokens += u_tok

        if current:
            chunks.append("\n".join(current))
        return chunks

    def _split_markdown(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        lines = text.splitlines()
        sections: List[tuple[str, List[str]]] = []
        current_header = ""
        current_lines: List[str] = []
        in_code = False

        for line in lines:
            if line.strip().startswith("```"):
                in_code = not in_code
                current_lines.append(line)
                continue
            if not in_code and re.match(r"^#{1,4}\s+\S", line.strip()):
                if any(l.strip() for l in current_lines):
                    sections.append((current_header, current_lines))
                current_header = line.strip()
                current_lines = [current_header]
            else:
                current_lines.append(line)

        if any(l.strip() for l in current_lines):
            sections.append((current_header, current_lines))

        if len(sections) <= 1:
            return self._split_recursive(text, chunk_size, chunk_overlap)

        chunks: List[str] = []
        buffer = ""
        for header, sec_lines in sections:
            sec_text = "\n".join(sec_lines).strip()
            sec_tokens = self.count_tokens(sec_text)
            if sec_tokens > chunk_size:
                if buffer:
                    chunks.append(buffer.strip())
                    buffer = ""
                sub_splits = self._split_recursive(sec_text, chunk_size, chunk_overlap)
                for idx, sub in enumerate(sub_splits):
                    if idx > 0 and header and not sub.startswith(header):
                        sub = f"{header}\n{sub}"
                    chunks.append(sub)
            elif buffer and self.count_tokens(buffer + "\n\n" + sec_text) <= chunk_size:
                buffer = f"{buffer}\n\n{sec_text}"
            else:
                if buffer:
                    chunks.append(buffer.strip())
                buffer = sec_text

        if buffer:
            chunks.append(buffer.strip())
        return chunks

    def _split_semantic(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        units = self._split_sentences_preserving_code(text)
        if not units:
            return self._split_recursive(text, chunk_size, chunk_overlap)

        chunks: List[str] = []
        current: List[str] = []
        current_tokens = 0
        min_semantic_tokens = max(120, int(chunk_size * 0.35))

        for unit in units:
            u_tok = self.count_tokens(unit)
            if u_tok > chunk_size:
                if current:
                    chunks.append("\n".join(current))
                    current = []
                    current_tokens = 0
                chunks.extend(self._split_recursive(unit, chunk_size, chunk_overlap))
                continue

            if not current:
                current.append(unit)
                current_tokens = u_tok
                continue

            if current_tokens + u_tok > chunk_size:
                chunks.append("\n".join(current))
                current = [unit]
                current_tokens = u_tok
                continue

            # Start a new topic chunk when similarity drops cleanly after reaching min_semantic_tokens
            if current_tokens >= min_semantic_tokens:
                sim = _cosine_text_sim(" ".join(current[-3:]), unit)
                is_header = bool(re.match(r"^#{1,4}\s", unit))
                if is_header or sim < 0.04:
                    chunks.append("\n".join(current))
                    current = [unit]
                    current_tokens = u_tok
                    continue

            current.append(unit)
            current_tokens += u_tok

        if current:
            chunks.append("\n".join(current))
        return chunks

    def chunk(
        self,
        text: str,
        chunk_size: int = 800,
        chunk_overlap: int = 100,
        method: str = "recursive",
    ) -> List[Dict[str, Any]]:
        if not text or not text.strip():
            return []

        strategy = (method or "recursive").lower()
        if strategy == "markdown":
            splits = self._split_markdown(text, chunk_size, chunk_overlap)
        elif strategy == "semantic":
            splits = self._split_semantic(text, chunk_size, chunk_overlap)
        elif strategy == "sentence":
            splits = self._split_sentence_window(text, chunk_size, chunk_overlap)
        else:
            strategy = "recursive"
            splits = self._split_recursive(text, chunk_size, chunk_overlap)

        chunks: List[Dict[str, Any]] = []
        for i, split_text in enumerate(splits):
            clean_split = split_text.strip()
            if not clean_split:
                continue
            chunks.append(
                {
                    "chunk_id": len(chunks),
                    "text": clean_split,
                    "token_count": self.count_tokens(clean_split),
                    "strategy": strategy,
                }
            )

        return chunks


chunking_engine = ChunkingEngine()
