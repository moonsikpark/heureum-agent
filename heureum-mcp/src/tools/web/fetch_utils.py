# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Web fetch content extraction utilities.

Provides HTML→Markdown conversion, plain text extraction, content truncation,
and Firecrawl fallback for content extraction.
"""
import json
import logging
import re
from dataclasses import dataclass
from typing import Literal

import httpx
from readability import Document

from src.config import settings

logger = logging.getLogger(__name__)

ExtractMode = Literal["markdown", "text"]


def _decode_entities(value: str) -> str:
    """Decode common HTML entities."""
    value = value.replace("&nbsp;", " ")
    value = value.replace("&amp;", "&")
    value = value.replace("&quot;", '"')
    value = value.replace("&#39;", "'")
    value = value.replace("&lt;", "<")
    value = value.replace("&gt;", ">")
    value = re.sub(
        r"&#x([0-9a-fA-F]+);",
        lambda m: chr(int(m.group(1), 16)),
        value,
    )
    value = re.sub(
        r"&#(\d+);",
        lambda m: chr(int(m.group(1), 10)),
        value,
    )
    return value


def _strip_tags(value: str) -> str:
    """Remove all HTML tags and decode entities."""
    return _decode_entities(re.sub(r"<[^>]+>", "", value))


def _normalize_whitespace(value: str) -> str:
    """Collapse excessive whitespace."""
    value = value.replace("\r", "")
    value = re.sub(r"[ \t]+\n", "\n", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]{2,}", " ", value)
    return value.strip()


def html_to_markdown(html: str) -> tuple[str, str | None]:
    """Convert HTML to Markdown, preserving links, headings, and lists.

    Args:
        html (str): Raw HTML content to convert.

    Returns:
        tuple[str, str | None]: A tuple of (markdown_text, title) where title
            is extracted from the HTML <title> tag, or None if not present.
    """
    # Extract title
    title_match = re.search(r"<title[^>]*>([\s\S]*?)</title>", html, re.I)
    title = _normalize_whitespace(_strip_tags(title_match.group(1))) if title_match else None

    text = html
    # Remove script/style/noscript blocks
    text = re.sub(r"<script[\s\S]*?</script>", "", text, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", "", text, flags=re.I)
    text = re.sub(r"<noscript[\s\S]*?</noscript>", "", text, flags=re.I)

    # Convert links: <a href="url">text</a> → [text](url)
    def _convert_link(m: re.Match) -> str:
        href = m.group(1)
        body = _normalize_whitespace(_strip_tags(m.group(2)))
        if not body:
            return href
        return f"[{body}]({href})"

    text = re.sub(
        r"""<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)</a>""",
        _convert_link,
        text,
        flags=re.I,
    )

    # Convert headings: <h1>text</h1> → # text
    def _convert_heading(m: re.Match) -> str:
        level = max(1, min(6, int(m.group(1))))
        prefix = "#" * level
        body = _normalize_whitespace(_strip_tags(m.group(2)))
        return f"\n{prefix} {body}\n"

    text = re.sub(r"<h([1-6])[^>]*>([\s\S]*?)</h\1>", _convert_heading, text, flags=re.I)

    # Convert list items: <li>text</li> → - text
    def _convert_li(m: re.Match) -> str:
        body = _normalize_whitespace(_strip_tags(m.group(1)))
        return f"\n- {body}" if body else ""

    text = re.sub(r"<li[^>]*>([\s\S]*?)</li>", _convert_li, text, flags=re.I)

    # Convert breaks and block elements
    text = re.sub(r"<(br|hr)\s*/?>", "\n", text, flags=re.I)
    text = re.sub(
        r"</(p|div|section|article|header|footer|table|tr|ul|ol)>",
        "\n",
        text,
        flags=re.I,
    )

    # Strip remaining tags and normalize
    text = _strip_tags(text)
    text = _normalize_whitespace(text)

    return text, title


def markdown_to_text(markdown: str) -> str:
    """Strip Markdown formatting to plain text.

    Args:
        markdown (str): Markdown-formatted text to convert.

    Returns:
        str: Plain text with all Markdown formatting removed and
            whitespace normalized.
    """
    text = markdown
    # Remove images
    text = re.sub(r"!\[[^\]]*]\([^)]+\)", "", text)
    # Convert links to just the label
    text = re.sub(r"\[([^\]]+)]\([^)]+\)", r"\1", text)
    # Strip code blocks
    text = re.sub(r"```[\s\S]*?```", lambda m: re.sub(r"```[^\n]*\n?", "", m.group(0)), text)
    # Strip inline code
    text = re.sub(r"`([^`]+)`", r"\1", text)
    # Strip heading markers
    text = re.sub(r"^#{1,6}\s+", "", text, flags=re.M)
    # Strip list markers
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)
    text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.M)
    return _normalize_whitespace(text)


@dataclass
class ExtractedContent:
    """Result of extracting content from a web page.

    Attributes:
        title (str | None): Page title, or None if unavailable.
        text (str): The extracted content body.
        extractor (str): Name of the extraction method used, e.g.
            "readability", "html_fallback", "json", "raw", or "firecrawl".
    """

    title: str | None
    text: str
    extractor: str


def extract_content(
    body: str,
    *,
    content_type: str,
    url: str = "",
    extract_mode: ExtractMode = "markdown",
) -> ExtractedContent:
    """Extract readable content from an HTTP response body.

    Handles HTML (via Readability + Markdown conversion), JSON, and plain text.

    Args:
        body (str): The raw HTTP response body.
        content_type (str): The Content-Type header value from the response.
        url (str): The URL of the fetched page, used for context.
        extract_mode (ExtractMode): Output format, either "markdown" or "text".

    Returns:
        ExtractedContent: Extracted content with title, text body, and
            extractor name.
    """
    ct_lower = content_type.lower()

    if "text/html" in ct_lower:
        return _extract_html(body, url=url, extract_mode=extract_mode)

    if "application/json" in ct_lower or "text/json" in ct_lower:
        return _extract_json(body)

    # Plain text or unknown: return as-is
    return ExtractedContent(title=None, text=body.strip(), extractor="raw")


def _extract_html(body: str, *, url: str, extract_mode: ExtractMode) -> ExtractedContent:
    """Extract content from HTML using Readability with Markdown/text fallback."""
    try:
        doc = Document(body)
        content_html = doc.summary()
        title = doc.title() or None

        if not content_html or len(content_html.strip()) < 50:
            # Readability failed to extract meaningful content, use raw HTML conversion
            return _fallback_html(body, extract_mode=extract_mode)

        if extract_mode == "text":
            text = _strip_tags(content_html)
            text = _normalize_whitespace(text)
        else:
            text, _ = html_to_markdown(content_html)

        if not text.strip():
            return _fallback_html(body, extract_mode=extract_mode)

        return ExtractedContent(title=title, text=text, extractor="readability")

    except Exception:
        return _fallback_html(body, extract_mode=extract_mode)


def _fallback_html(body: str, *, extract_mode: ExtractMode) -> ExtractedContent:
    """Fallback: convert raw HTML directly."""
    md_text, title = html_to_markdown(body)
    if extract_mode == "text":
        text = markdown_to_text(md_text)
    else:
        text = md_text
    return ExtractedContent(title=title, text=text, extractor="html_fallback")


def _extract_json(body: str) -> ExtractedContent:
    """Extract JSON content with pretty-printing."""
    try:
        parsed = json.loads(body)
        text = json.dumps(parsed, indent=2, ensure_ascii=False)
        return ExtractedContent(title=None, text=text, extractor="json")
    except (json.JSONDecodeError, ValueError):
        return ExtractedContent(title=None, text=body.strip(), extractor="raw")


async def fetch_firecrawl(url: str) -> ExtractedContent | None:
    """Fallback: extract content via Firecrawl API.

    Silently catches all errors so the caller can continue with other fallbacks.

    Args:
        url (str): The URL to scrape via Firecrawl.

    Returns:
        ExtractedContent | None: Extracted content on success, or None if
            Firecrawl is disabled, the API key is missing, or any error occurs.
    """
    if not settings.FIRECRAWL_ENABLED or not settings.FIRECRAWL_API_KEY:
        return None

    try:
        async with httpx.AsyncClient(timeout=settings.FIRECRAWL_TIMEOUT) as client:
            response = await client.post(
                f"{settings.FIRECRAWL_BASE_URL}/v1/scrape",
                json={
                    "url": url,
                    "formats": ["markdown"],
                    "onlyMainContent": True,
                    "timeout": int(settings.FIRECRAWL_TIMEOUT * 1000),
                },
                headers={
                    "Authorization": f"Bearer {settings.FIRECRAWL_API_KEY}",
                },
            )

            if not response.is_success:
                logger.warning("Firecrawl API error: HTTP %d", response.status_code)
                return None

            data = response.json()
            if not data.get("success"):
                logger.warning("Firecrawl returned success=false for %s", url)
                return None

            content = data.get("data", {})
            markdown = content.get("markdown", "")
            if not markdown:
                return None

            metadata = content.get("metadata", {})
            title = metadata.get("title")

            return ExtractedContent(
                title=title,
                text=markdown,
                extractor="firecrawl",
            )
    except Exception as e:
        logger.warning("Firecrawl fallback failed: %s", e)
        return None
