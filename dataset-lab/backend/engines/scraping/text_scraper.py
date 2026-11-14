import aiohttp
import json
import logging
import re
import ssl
from typing import Optional, Dict, Any, List
from urllib.parse import urljoin
from bs4 import BeautifulSoup, Tag
from readability import Document

logger = logging.getLogger(__name__)


async def fetch_html(url: str, session: aiohttp.ClientSession) -> Optional[str]:
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE

    for attempt in range(2):
        try:
            async with session.get(
                url, headers=headers, timeout=25, allow_redirects=True, ssl=ssl_context
            ) as response:
                if response.status == 200:
                    raw_bytes = await response.read()
                    charset = response.charset or "utf-8"
                    try:
                        return raw_bytes.decode(charset, errors="replace")
                    except LookupError:
                        return raw_bytes.decode("utf-8", errors="replace")
                if response.status in (403, 401, 400, 404):
                    logger.warning(f"Blocked/Missing {url}, status code: {response.status}")
                    return None
                logger.warning(f"Fetch {url} returned status {response.status}")
        except Exception as e:
            if attempt == 1:
                logger.error(f"Error fetching {url}: {e}")
    return None


def _html_node_to_markdown(soup: BeautifulSoup) -> str:
    """Convert structural HTML tags inside a BeautifulSoup subtree into clean Markdown."""
    for tag in soup.find_all(["script", "style", "noscript", "svg", "nav", "footer", "aside"]):
        tag.decompose()

    # Convert headings
    for level in range(1, 7):
        for h in soup.find_all(f"h{level}"):
            txt = h.get_text(" ", strip=True)
            if txt:
                h.replace_with(f"\n\n{'#' * level} {txt}\n\n")

    # Convert preformatted code blocks
    for pre in soup.find_all("pre"):
        code_text = pre.get_text("\n")
        pre.replace_with(f"\n\n```\n{code_text.strip()}\n```\n\n")

    # Convert tables into markdown tables
    for table in soup.find_all("table"):
        rows_md = []
        for idx, tr in enumerate(table.find_all("tr")):
            cells = [c.get_text(" ", strip=True).replace("|", "\\|") for c in tr.find_all(["th", "td"])]
            if not cells:
                continue
            rows_md.append("| " + " | ".join(cells) + " |")
            if idx == 0:
                rows_md.append("| " + " | ".join("---" for _ in cells) + " |")
        if rows_md:
            table.replace_with("\n\n" + "\n".join(rows_md) + "\n\n")
        else:
            table.decompose()

    # Convert list items
    for li in soup.find_all("li"):
        if isinstance(li, Tag):
            txt = li.get_text(" ", strip=True)
            if txt:
                li.replace_with(f"\n- {txt}")

    raw_text = soup.get_text(separator="\n")
    # Clean excess spaces on each line
    lines = [re.sub(r"[ \t]+", " ", l).strip() for l in raw_text.splitlines()]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def _extract_jsonld_article_body(full_soup: BeautifulSoup) -> str:
    for script in full_soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            payload = json.loads(script.string or "")
            items = payload if isinstance(payload, list) else [payload]
            for item in items:
                if isinstance(item, dict) and isinstance(item.get("articleBody"), str):
                    if len(item["articleBody"]) > 100:
                        return item["articleBody"].strip()
        except Exception:
            continue
    return ""


def extract_article(html_content: str, url: str) -> Dict[str, Any]:
    """Extracts the main article body, title, headings, and structured Markdown text."""
    try:
        full_soup = BeautifulSoup(html_content, "html.parser")
        doc = Document(html_content)
        title = (doc.title() or "").strip()
        if not title and full_soup.title:
            title = full_soup.title.get_text(strip=True)

        readable_html = doc.summary()
        soup = BeautifulSoup(readable_html, "html.parser")
        headings = [h.get_text(" ", strip=True) for h in soup.find_all(["h1", "h2", "h3", "h4"])]
        text_content = _html_node_to_markdown(soup)

        # Fallback to <main>/<article>/JSON-LD if Readability got almost nothing (e.g. docs/wikis)
        if len(text_content) < 150:
            ld_body = _extract_jsonld_article_body(full_soup)
            if len(ld_body) > len(text_content):
                text_content = ld_body
            else:
                main_node = full_soup.find("article") or full_soup.find("main") or full_soup.body
                if main_node:
                    fallback_soup = BeautifulSoup(str(main_node), "html.parser")
                    fallback_text = _html_node_to_markdown(fallback_soup)
                    if len(fallback_text) > len(text_content):
                        text_content = fallback_text

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
    """Extracts heuristic-filtered URLs from anchor tags."""
    try:
        soup = BeautifulSoup(html_content, "html.parser")
        links = []
        skip_patterns = [
            "/login",
            "/logout",
            "?sort=",
            "/cart",
            "signup",
            "register",
            "mailto:",
            "tel:",
            "javascript:",
        ]
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith("#"):
                continue
            if any(skip in href.lower() for skip in skip_patterns):
                continue

            full_url = urljoin(base_url, href).split("#")[0]
            if full_url.startswith("http"):
                links.append(full_url)

        return list(dict.fromkeys(links))
    except Exception as e:
        logger.error(f"Failed to extract links from {base_url}: {e}")
        return []


def compute_relevance_score(
    text: str, title: str, url: str, query_tokens: List[str]
) -> float:
    """Computes a heuristic BM25/TF-IDF approximation score for crawler prioritization."""
    if not query_tokens:
        return 1.0

    score = 0.0
    text_lower = text.lower()
    title_lower = title.lower()
    url_lower = url.lower()

    for token in query_tokens:
        tok = token.lower()
        if len(tok) < 3:
            continue

        if tok in url_lower:
            score += 5.0
        if tok in title_lower:
            score += 3.0

        count = len(re.findall(r"\b" + re.escape(tok) + r"\b", text_lower))
        score += min(count * 0.5, 10.0)

    return score
