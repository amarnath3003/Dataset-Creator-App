import re
from urllib.parse import urlparse

# ─────────────────────────────────────────────────────────────────────────────
# Boilerplate Phrase Fragments (substring match, case-insensitive)
# These are patterns that commonly appear in navigational/UI noise.
# ─────────────────────────────────────────────────────────────────────────────
BOILERPLATE_FRAGMENTS = [
    # Cookie & Privacy noise
    "accept cookies",
    "cookie policy",
    "cookie consent",
    "we use cookies",
    "gdpr",
    "privacy policy",
    "terms of service",
    "terms and conditions",
    "by using this site",
    "by continuing to browse",
    # Newsletter / Ads
    "subscribe to our newsletter",
    "sign up for our newsletter",
    "subscribe now",
    "join our mailing list",
    "email address",
    "unsubscribe",
    "click here to unsubscribe",
    # Navigation UI
    "skip to content",
    "skip to main content",
    "back to top",
    "all rights reserved",
    "copyright ©",
    "© 20",
    # Engagement bait (common in scraped content)
    "read more",
    "learn more",
    "click here",
    "find out more",
    "see more",
    "view all",
    "show more",
    "load more",
    "click to expand",
    "share this article",
    "share on",
    "follow us on",
    # Social / Ratings
    "like us on facebook",
    "follow us on twitter",
    "follow us on instagram",
    "tweet this",
    "pin it",
    "add to cart",
    "buy now",
    # Site chrome
    "advertisement",
    "sponsored content",
    "promoted",
    "posted in",
    "filed under",
    "tags:",
    "categories:",
    "you might also like",
    "related articles",
    "related posts",
    "more from",
    "trending now",
    "popular posts",
    # Comments sections
    "leave a comment",
    "add a comment",
    "post a comment",
    "be the first to comment",
    "no comments yet",
    "login to comment",
    "sign in to comment",
    # Search / Forms
    "search for",
    "enter your search",
    "type to search",
    # Navigation breadcrumbs
    "home »",
    "home >",
    "« previous",
    "next »",
    # Paywalls
    "subscribe to read",
    "to continue reading",
    "this content is for subscribers",
    "create a free account",
]

# ─────────────────────────────────────────────────────────────────────────────
# Regex Patterns for Structural Noise
# ─────────────────────────────────────────────────────────────────────────────
# Lines that are just a bunch of nav links separated by pipes or bullets
NAV_SEPARATOR_RE = re.compile(r"^[\w\s\-]+(\s*[\|›•·]\s*[\w\s\-]+){2,}$")

# Lines that look like counters or stats (e.g., "5 min read", "1.2K views")
COUNTER_RE = re.compile(
    r"^\d+[\.,]?\d*\s*(min read|views?|comments?|shares?|likes?|claps?|reactions?|reads?)$",
    re.IGNORECASE,
)

# Lines with excessive punctuation or symbols (usually broken encoding / ads)
SYMBOL_HEAVY_RE = re.compile(r"^[^a-zA-Z0-9\s]{4,}$")

# Leftover HTML entities
HTML_ENTITY_RE = re.compile(r"&[a-z]{2,8};|&#\d{1,6};", re.IGNORECASE)

# Leftover HTML tags that slipped through
HTML_TAG_RE = re.compile(r"<[^>]+>")

# URL-looking strings on their own line
STANDALONE_URL_RE = re.compile(r"^https?://\S+$")

# Lines that are pure numbers or single characters (usually pagination artifacts)
TRIVIAL_LINE_RE = re.compile(r"^\W{0,2}$|^\d{1,4}\W{0,2}$")

# Repeated dashes/underscores/equals (horizontal rules)
HORIZONTAL_RULE_RE = re.compile(r"^[-=_*]{3,}$")


def _is_boilerplate_line(line: str) -> bool:
    """Returns True if the line is known boilerplate/navigation noise."""
    lower = line.lower().strip()
    for fragment in BOILERPLATE_FRAGMENTS:
        if fragment in lower:
            return True
    return False


def _score_line(line: str) -> bool:
    """
    Returns True if this line should be KEPT.
    A line is dropped if it matches any structural noise pattern.
    """
    stripped = line.strip()

    if not stripped:
        return False

    # Drop very short lines (< 15 chars) — these are usually menu items or labels
    if len(stripped) < 15:
        return False

    # Drop nav separators (Home | About | Contact | ...)
    if NAV_SEPARATOR_RE.match(stripped):
        return False

    # Drop counter lines (e.g. "3 min read")
    if COUNTER_RE.match(stripped):
        return False

    # Drop symbol-only lines
    if SYMBOL_HEAVY_RE.match(stripped):
        return False

    # Drop standalone URLs
    if STANDALONE_URL_RE.match(stripped):
        return False

    # Drop trivial lines (just numbers, punctuation, etc.)
    if TRIVIAL_LINE_RE.match(stripped):
        return False

    # Drop horizontal rules
    if HORIZONTAL_RULE_RE.match(stripped):
        return False

    # Drop known boilerplate phrases
    if _is_boilerplate_line(stripped):
        return False

    return True


def _collapse_whitespace(text: str) -> str:
    """Normalize whitespace without destroying paragraph structure."""
    # Remove HTML leftovers
    text = HTML_TAG_RE.sub(" ", text)
    text = HTML_ENTITY_RE.sub(" ", text)
    # Normalize spaces within lines (but keep newlines)
    text = re.sub(r"[ \t]+", " ", text)
    # Collapse more than 2 consecutive newlines into a paragraph break
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def _deduplicate_paragraphs(paragraphs: list[str]) -> list[str]:
    """
    Remove duplicate or near-duplicate adjacent lines.
    Useful when scrapers collect the same headline text multiple times.
    """
    seen = set()
    result = []
    for p in paragraphs:
        key = re.sub(r"\W+", "", p.lower())[:80]  # normalised key for comparison
        if key not in seen:
            seen.add(key)
            result.append(p)
    return result


def clean_text_content(text: str) -> str:
    """
    Multi-stage heuristic cleaner for scraped web text.

    Pipeline:
      1. Strip leftover HTML tags and entities
      2. Normalize whitespace
      3. Filter lines through structural noise rules
      4. Remove boilerplate fragments
      5. Deduplicate repeated content
      6. Final paragraph assembly
    """
    if not text:
        return ""

    # Stage 1 & 2: HTML cleanup + whitespace normalization
    text = _collapse_whitespace(text)

    # Stage 3 & 4: Line-level filtering
    lines = text.split("\n")
    filtered = [line for line in lines if _score_line(line)]

    # Stage 5: Deduplicate
    filtered = _deduplicate_paragraphs(filtered)

    # Stage 6: Rejoin and trim
    cleaned = "\n\n".join(line.strip() for line in filtered)
    return cleaned.strip()


def sanitize_url(url: str) -> str:
    """Remove tracking query parameters from URLs."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
