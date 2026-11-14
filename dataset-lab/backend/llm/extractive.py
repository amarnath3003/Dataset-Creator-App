import json
import re
from typing import Dict, Any, List
from .base import LLMProvider


def _extract_chunk_and_meta(prompt: str) -> tuple[str, str, int]:
    """Parse chunk body, domain, and requested qa_count out of the rendered prompt."""
    domain_match = re.search(r"Context Domain:\s*(.+?)\.", prompt)
    domain = domain_match.group(1).strip() if domain_match else "general"

    count_match = re.search(r"create(?:\s+exactly)?\s+(\d+)\s+high-quality", prompt, re.I)
    qa_count = int(count_match.group(1)) if count_match else 2

    chunk_match = re.search(
        r"Text Chunk:\s*\n(.*?)(?:\n\s*Instructions:|\Z)", prompt, re.DOTALL
    )
    chunk_text = chunk_match.group(1).strip() if chunk_match else prompt.strip()
    return chunk_text, domain, max(1, min(qa_count, 8))


def _clean_subject(raw: str) -> str:
    subject = re.sub(r"^(The|A|An|In|On|At|For|With|This|These|That)\s+", "", raw.strip(), flags=re.I)
    subject = re.sub(r"[#*_`]+", "", subject).strip(" .,:;-")
    if len(subject) > 70:
        subject = " ".join(subject.split()[:8])
    return subject


def _split_factual_sentences(text: str) -> List[str]:
    clean = re.sub(r"```[\s\S]*?```", " ", text)
    clean = re.sub(r"\n+", " ", clean)
    sents = re.split(r"(?<=[.!?])\s+", clean)
    out = []
    for s in sents:
        s = re.sub(r"\s+", " ", s).strip()
        if len(s) >= 28 and re.search(r"[a-zA-Z]{3,}", s):
            out.append(s)
    return out


class ExtractiveLLM(LLMProvider):
    """Deterministic zero-dependency extractive QA synthesizer for offline & fast dataset curation."""

    def generate(self, prompt: str, config: Dict[str, Any]) -> str:
        chunk_text, domain, qa_count = _extract_chunk_and_meta(prompt)
        sentences = _split_factual_sentences(chunk_text)
        headings = [
            re.sub(r"^#{1,6}\s+", "", line.strip())
            for line in chunk_text.splitlines()
            if re.match(r"^#{1,6}\s+\S", line.strip())
        ]
        bullets = [
            re.sub(r"^[-*•]\s+", "", line.strip())
            for line in chunk_text.splitlines()
            if re.match(r"^[-*•]\s+\S", line.strip()) and len(line.strip()) > 20
        ]

        candidates: List[Dict[str, str]] = []
        used_questions = set()

        # 1. Definition patterns ("X is/are/refers to/provides Y")
        for sent in sentences:
            m = re.match(
                r"^([A-Z][A-Za-z0-9\s/\-()]{2,55}?)\s+(is|are|refers to|means|provides|enables|uses|supports)\s+(.+)$",
                sent,
            )
            if m:
                subj = _clean_subject(m.group(1))
                verb = m.group(2).lower()
                if verb in ("is", "are", "refers to", "means"):
                    q = f"What {verb} {subj}?" if verb in ("is", "are") else f"What does {subj} mean or refer to?"
                else:
                    q = f"What does {subj} do and how does it work in {domain}?"
                if q.lower() not in used_questions:
                    used_questions.add(q.lower())
                    candidates.append(
                        {
                            "question": q,
                            "answer": sent,
                            "rejected": f"{subj} is an unrelated concept with no defined role in the provided context.",
                        }
                    )

        # 2. Section / Heading anchored QA
        for heading in headings:
            clean_h = _clean_subject(heading)
            if not clean_h:
                continue
            # Gather up to 3 relevant sentences in the chunk
            body_sents = [s for s in sentences if clean_h.lower() in s.lower()] or sentences[:3]
            if body_sents:
                ans = " ".join(body_sents[:3])
                q = f"Explain {clean_h} based on the documentation."
                if q.lower() not in used_questions:
                    used_questions.add(q.lower())
                    candidates.append(
                        {
                            "question": q,
                            "answer": ans,
                            "rejected": f"There is no information available regarding {clean_h}.",
                        }
                    )

        # 3. Bullet list / procedure takeaways
        if len(bullets) >= 2:
            topic = _clean_subject(headings[0]) if headings else domain
            q = f"What are the key points or details highlighted about {topic}?"
            if q.lower() not in used_questions:
                used_questions.add(q.lower())
                ans = "Key details include:\n" + "\n".join(f"- {b}" for b in bullets[:5])
                candidates.append(
                    {
                        "question": q,
                        "answer": ans,
                        "rejected": "None of these details were specified in the source text.",
                    }
                )

        # 4. General sliding window over factual sentences if we still need more pairs
        idx = 0
        while len(candidates) < qa_count and idx < len(sentences):
            window = sentences[idx : idx + 2]
            ans = " ".join(window)
            first = window[0]
            # Derive a natural question from the leading noun phrase or first few words
            words = re.findall(r"[A-Za-z0-9\-]+", first)
            topic = " ".join(words[:6]) if words else domain
            if re.search(r"\b(how|step|process|method|configure|build|train|run)\b", first, re.I):
                q = f"How does the process involving {topic.lower()} work?"
            elif re.search(r"\b(why|because|benefit|reason|prevent|improve)\b", first, re.I):
                q = f"Why is {topic.lower()} important in this context?"
            else:
                q = f"What key facts are described regarding {topic.lower()}?"

            if q.lower() not in used_questions:
                used_questions.add(q.lower())
                candidates.append(
                    {
                        "question": q,
                        "answer": ans,
                        "rejected": "Insufficient evidence was provided to explain this point.",
                    }
                )
            idx += 2

        # Final fallback if chunk had unusual formatting (e.g. tables or code only)
        if not candidates and chunk_text:
            snippet = chunk_text[:600].strip()
            candidates.append(
                {
                    "question": f"Summarize the information presented in this {domain} excerpt.",
                    "answer": snippet,
                    "rejected": "No summary is possible from the provided excerpt.",
                }
            )

        return json.dumps(candidates[:qa_count], ensure_ascii=False)
