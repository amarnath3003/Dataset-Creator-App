import aiohttp
import os
import aiofiles
import logging
import ssl
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse
import io

try:
    from PIL import Image
except ImportError:
    Image = None

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
MIN_IMAGE_SIZE = (150, 150)


def is_valid_image_url(url: str) -> bool:
    if url.startswith("data:image"):
        return False
    parsed = urlparse(url)
    ext = os.path.splitext(parsed.path)[1].lower().strip(".")
    # Note: CDNs sometimes serve images without extensions or with dynamic query strings,
    # so we only exclude explicitly non-image extensions if present.
    if ext and ext not in ALLOWED_EXTENSIONS:
        return False
    return True


def extract_image_urls(html_content: str, base_url: str) -> list[dict]:
    """
    Extracts images and their surrounding context (alt text, parent text).
    """
    soup = BeautifulSoup(html_content, "html.parser")
    images = []

    for img in soup.find_all("img"):
        src = img.get("src")
        if not src:
            continue

        full_url = urljoin(base_url, src)
        if not is_valid_image_url(full_url):
            continue

        alt_text = img.get("alt", "")
        title_text = img.get("title", "")
        filename = os.path.basename(urlparse(full_url).path)

        # Try to find a caption or surrounding text
        parent_text = img.parent.get_text(separator=" ", strip=True)[:200]

        # Heuristic Context Construction string
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

        # Optional: Preliminary dimension check from HTML attributes
        try:
            w = int(img.get("width", 999))
            h = int(img.get("height", 999))
            if w < MIN_IMAGE_SIZE[0] or h < MIN_IMAGE_SIZE[1]:
                continue
        except ValueError:
            pass

        images.append({"url": full_url, "heuristic_label": heuristic_label})

    return images


async def download_image(
    url: str, save_dir: str, session: aiohttp.ClientSession
) -> str | None:
    try:
        os.makedirs(save_dir, exist_ok=True)
        filename = os.path.basename(urlparse(url).path)
        if not filename:
            filename = "downloaded_image"

        save_path = os.path.join(save_dir, filename)

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Connection": "keep-alive",
        }

        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE

        async with session.get(
            url, headers=headers, timeout=15, ssl=ssl_context
        ) as response:
            if response.status == 200:
                # Need to read content and verify headers
                content = await response.read()

                # Determine image type
                content_type = response.headers.get("Content-Type", "").lower()
                img_type = None

                if "image/" in content_type:
                    img_type = content_type.split("/")[-1].split(";")[0]
                else:
                    # Fallback standard magic numbers if headers lie (like imghdr used to do)
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
                    and img_type
                    not in ["jpeg", "jpg", "png", "webp", "avif", "gif", "svg"]
                ):
                    logger.debug(f"Skipping invalid image type: {img_type} for {url}")
                    return None

                # Strict 150x150 dimension check using PIL (pillow)
                if Image:
                    try:
                        pil_img = Image.open(io.BytesIO(content))
                        if (
                            pil_img.width < MIN_IMAGE_SIZE[0]
                            or pil_img.height < MIN_IMAGE_SIZE[1]
                        ):
                            logger.debug(
                                f"Skipping small object ({pil_img.width}x{pil_img.height}): {url}"
                            )
                            return None
                    except Exception as e:
                        logger.debug(f"Failed to read image dimensions for {url}: {e}")

                # If the filename didn't have an extension, add it
                if not os.path.splitext(save_path)[1]:
                    save_path += f".{img_type}"

                async with aiofiles.open(save_path, "wb") as f:
                    await f.write(content)

                return save_path
            else:
                return None
    except Exception as e:
        logger.error(f"Error downloading image {url}: {e}")
        return None
