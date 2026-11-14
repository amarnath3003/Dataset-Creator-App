import hashlib
import io
import logging
import os
import re
import ssl
from urllib.parse import urljoin, urlparse

import aiofiles
import aiohttp
from bs4 import BeautifulSoup

try:
    from PIL import Image
except ImportError:
    Image = None

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MIN_IMAGE_SIZE = (150, 150)


def is_valid_image_url(url: str) -> bool:
    if not url or url.startswith("data:image"):
        return False
    parsed = urlparse(url)
    ext = os.path.splitext(parsed.path)[1].lower().strip(".")
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False
    return True


def _pick_best_src(img) -> str | None:
    """Resolve real image source checking srcset and common lazy-loading attributes."""
    srcset = img.get("srcset") or img.get("data-srcset")
    if srcset:
        candidates = []
        for entry in srcset.split(","):
            parts = entry.strip().split()
            if not parts:
                continue
            url = parts[0]
            weight = 0
            if len(parts) > 1:
                m = re.match(r"(\d+)[wx]", parts[1])
                if m:
                    weight = int(m.group(1))
            candidates.append((weight, url))
        if candidates:
            candidates.sort(key=lambda x: x[0], reverse=True)
            if candidates[0][1] and not candidates[0][1].startswith("data:image"):
                return candidates[0][1]

    for attr in ("src", "data-src", "data-lazy-src", "data-original", "data-url"):
        val = img.get(attr)
        if val and not str(val).strip().startswith("data:image"):
            return str(val).strip()
    return None


def extract_image_urls(html_content: str, base_url: str) -> list[dict]:
    """Extracts images (including lazy-loaded, srcset, and og:image) with surrounding context."""
    soup = BeautifulSoup(html_content, "html.parser")
    images = []
    seen_urls = set()

    # Check OpenGraph / Twitter hero images first
    for meta in soup.find_all("meta", attrs={"property": ["og:image", "twitter:image"]}):
        content = meta.get("content")
        if content:
            full_url = urljoin(base_url, content)
            if is_valid_image_url(full_url) and full_url not in seen_urls:
                seen_urls.add(full_url)
                images.append({"url": full_url, "heuristic_label": "OpenGraph Featured Image"})

    for img in soup.find_all("img"):
        src = _pick_best_src(img)
        if not src:
            continue

        full_url = urljoin(base_url, src)
        if full_url in seen_urls or not is_valid_image_url(full_url):
            continue

        alt_text = img.get("alt", "")
        title_text = img.get("title", "")
        filename = os.path.basename(urlparse(full_url).path)
        parent_text = img.parent.get_text(separator=" ", strip=True)[:200] if img.parent else ""

        context_parts = []
        if alt_text:
            context_parts.append(f"Alt: {alt_text}")
        if title_text:
            context_parts.append(f"Title: {title_text}")
        if filename:
            context_parts.append(f"Filename: {filename}")
        if parent_text:
            context_parts.append(f"Paragraph: {parent_text}")

        heuristic_label = " | ".join(context_parts)

        try:
            w = int(img.get("width", 999))
            h = int(img.get("height", 999))
            if w < MIN_IMAGE_SIZE[0] or h < MIN_IMAGE_SIZE[1]:
                continue
        except (ValueError, TypeError):
            pass

        seen_urls.add(full_url)
        images.append({"url": full_url, "heuristic_label": heuristic_label})

    return images


async def download_image(
    url: str, save_dir: str, session: aiohttp.ClientSession
) -> str | None:
    try:
        os.makedirs(save_dir, exist_ok=True)
        raw_name = os.path.basename(urlparse(url).path) or "image"
        safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", raw_name)[:64]
        url_hash = hashlib.md5(url.encode("utf-8")).hexdigest()[:8]
        filename = f"{url_hash}_{safe_name}"
        save_path = os.path.join(save_dir, filename)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            "Connection": "keep-alive",
        }

        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, headers=headers, timeout=15, ssl=ssl_context
        ) as response:
            if response.status != 200:
                return None

            content = await response.read()
            content_type = response.headers.get("Content-Type", "").lower()
            img_type = None

            if "image/" in content_type:
                img_type = content_type.split("/")[-1].split(";")[0].split("+")[0]
            else:
                if content.startswith(b"\xff\xd8\xff"):
                    img_type = "jpeg"
                elif content.startswith(b"\x89PNG\r\n\x1a\n"):
                    img_type = "png"
                elif content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
                    img_type = "gif"
                elif content.startswith(b"RIFF") and content[8:12] == b"WEBP":
                    img_type = "webp"

            if not img_type or (
                img_type not in ALLOWED_EXTENSIONS
                and img_type not in ["jpeg", "jpg", "png", "webp", "avif"]
            ):
                return None

            if Image:
                try:
                    pil_img = Image.open(io.BytesIO(content))
                    if (
                        pil_img.width < MIN_IMAGE_SIZE[0]
                        or pil_img.height < MIN_IMAGE_SIZE[1]
                    ):
                        return None
                except Exception:
                    return None

            if not os.path.splitext(save_path)[1]:
                save_path += f".{img_type}"

            async with aiofiles.open(save_path, "wb") as f:
                await f.write(content)

            return save_path
    except Exception as e:
        logger.debug(f"Error downloading image {url}: {e}")
        return None
