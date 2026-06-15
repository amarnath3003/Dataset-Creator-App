import re
from urllib.parse import urlparse

# Basic list of internal or private IP ranges to prevent SSRF
PRIVATE_IPS = [
    r"^127\.",
    r"^10\.",
    r"^172\.(1[6-9]|2[0-9]|3[0-1])\.",
    r"^192\.168\.",
    r"^localhost$",
    r"^::1$",
]


def is_safe_url(url: str) -> bool:
    """
    Checks if a URL is safe to scrape (prevents basic SSRF by restricting to public networks).
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            return False

        hostname = parsed.hostname
        if not hostname:
            return False

        for pattern in PRIVATE_IPS:
            if re.match(pattern, hostname):
                return False

        return True
    except Exception:
        return False


def extract_domain(url: str) -> str:
    try:
        parsed = urlparse(url)
        return parsed.netloc
    except Exception:
        return ""
