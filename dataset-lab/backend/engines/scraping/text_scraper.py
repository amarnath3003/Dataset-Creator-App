import aiohttp
from bs4 import BeautifulSoup
from readability import Document
from typing import Optional, Dict, Any, List
import logging
import ssl
import re
from urllib.parse import urljoin

logger = logging.getLogger(__name__)


async def fetch_html(url: str, session: aiohttp.ClientSession) -> Optional[str]:
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }

        # Bypass strict SSL checking for scraper
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, headers=headers, timeout=25, allow_redirects=True, ssl=ssl_context
        ) as response:
            if response.status == 200:
                return await response.text()
            elif response.status in (403, 401, 400):
                logger.warning(f"Blocked by {url}, status code: {response.status}")
                return None
            else:
                logger.warning(f"Failed to fetch {url}, status code: {response.status}")
                return None
    except Exception as e:
        logger.error(f"Error fetching {url}: {e}")
        return None


def extract_article(html_content: str, url: str) -> Dict[str, Any]:
    """
    Extracts the main article body, title, and metadata using Readability.
    """
    try:
        doc = Document(html_content)
        title = doc.title()

        # Get simplified HTML retaining only readable content
        readable_html = doc.summary()

        # Parse it with BeautifulSoup to get pure text and clean up
        soup = BeautifulSoup(readable_html, "html.parser")

        # Extract headings for structure
        headings = [
            h.get_text(strip=True) for h in soup.find_all(["h1", "h2", "h3", "h4"])
        ]

        text_content = soup.get_text(separator="\n", strip=True)

        return {
            "url": url,
            "title": title,
            "headings": headings,
            "text": text_content,
            "html_summary": readable_html,
        }
    except Exception as e:
        logger.error(f"Failed to extract article from {url}: {e}")
        return {}


def extract_links(html_content: str, base_url: str) -> List[str]:
    """
    Extracts heuristic-filtered URLs from anchor tags.
    Ignores common structural boundaries like login, cart, and sorting modifiers.
    """
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        links = []
        skip_patterns = [
            "/login",
            "?sort=",
            "/cart",
            "signup",
            "register",
            "#",
            "javascript:",
        ]
        for a in soup.find_all("a", href=True):
            href = a["href"]

            # Filter structural endpoints
            if any(skip in href.lower() for skip in skip_patterns):
                continue

            full_url = urljoin(base_url, href)
            # Basic validation
            if full_url.startswith("http"):
                links.append(full_url)

        # Deduplicate while preserving order
        return list(dict.fromkeys(links))
    except Exception as e:
        logger.error(f"Failed to extract links from {base_url}: {e}")
        return []


def compute_relevance_score(
    text: str, title: str, url: str, query_tokens: List[str]
) -> float:
    """
    Computes a heuristic BM25/TF-IDF approximation score for crawler prioritization.
    Weights URL matches heaviest, then Title, then Text body density.
    """
    if not query_tokens:
        return 1.0  # If no topic specified, treat everything as relevant.

    score = 0.0
    text_lower = text.lower()
    title_lower = title.lower()
    url_lower = url.lower()

    for token in query_tokens:
        tok = token.lower()
        if len(tok) < 3:
            continue

        # URL match
        if tok in url_lower:
            score += 5.0

        # Title match
        if tok in title_lower:
            score += 3.0

        # Text density (capped to prevent keyword stuffing inflation)
        count = len(re.findall(r"\b" + re.escape(tok) + r"\b", text_lower))
        score += min(count * 0.5, 10.0)

    return score
