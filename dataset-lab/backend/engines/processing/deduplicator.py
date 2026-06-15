import hashlib
import imagehash
import math
import re
from collections import Counter
from PIL import Image


def get_text_hash(text: str) -> str:
    """
    Creates a SHA-256 hash of string to find exact duplicates.
    """
    normalized = text.lower().strip()
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def text_to_vector(text: str) -> Counter:
    words = re.compile(r"\w+").findall(text.lower())
    return Counter(words)


def get_cosine(vec1: Counter, vec2: Counter) -> float:
    intersection = set(vec1.keys()) & set(vec2.keys())
    numerator = sum([vec1[x] * vec2[x] for x in intersection])
    sum1 = sum([vec1[x] ** 2 for x in vec1.keys()])
    sum2 = sum([vec2[x] ** 2 for x in vec2.keys()])
    denominator = math.sqrt(sum1) * math.sqrt(sum2)
    if not denominator:
        return 0.0
    return float(numerator) / denominator


def is_near_duplicate(
    text: str, seen_vectors: list[Counter], threshold: float = 0.85
) -> bool:
    """
    Checks if a text payload is a near-duplicate of previously seen items.
    Updates the seen_vectors list if it is novel.
    """
    vec1 = text_to_vector(text)
    for vec2 in seen_vectors:
        if get_cosine(vec1, vec2) > threshold:
            return True

    seen_vectors.append(vec1)
    return False


def get_image_hash(filepath: str) -> str | None:
    """
    Uses perceptual hashing to find visually similar images.
    """
    try:
        with Image.open(filepath) as img:
            # perceptual hash
            return str(imagehash.phash(img))
    except Exception:
        return None
