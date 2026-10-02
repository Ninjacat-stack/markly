"""Web content extraction. Retrieved pages are UNTRUSTED input: text only,
size-capped, scripts/styles dropped, never executed or followed blindly."""
from __future__ import annotations

import re
from html.parser import HTMLParser

import httpx

MAX_BYTES = 200_000
MAX_CHARS = 4000


class _TextStripper(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in ("script", "style", "noscript", "iframe"):
            self._skip += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in ("script", "style", "noscript", "iframe") and self._skip:
            self._skip -= 1

    def handle_data(self, data: str) -> None:
        if not self._skip and data.strip():
            self.parts.append(data.strip())


def strip_html(html: str) -> str:
    parser = _TextStripper()
    parser.feed(html[:MAX_BYTES])
    text = re.sub(r"\s+", " ", " ".join(parser.parts))
    return text[:MAX_CHARS]


def fetch_text(url: str, timeout_s: float = 15.0) -> str:
    """Fetch a page and return capped plain text. Empty string on any failure."""
    try:
        with httpx.Client(timeout=timeout_s, follow_redirects=True, max_redirects=3) as client:
            resp = client.get(url, headers={"User-Agent": "Markly-research/0.1"})
            if resp.status_code != 200:
                return ""
            ctype = resp.headers.get("content-type", "")
            if "html" not in ctype and "text" not in ctype:
                return ""
            return strip_html(resp.text[:MAX_BYTES])
    except Exception:
        return ""

