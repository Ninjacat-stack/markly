"""SearXNG search implementation. Needs SEARXNG_URL; otherwise inactive."""
from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx

from .base import SearchProvider, Source


class SearXNGProvider(SearchProvider):
    name = "searxng"

    def __init__(self, base_url: str | None = None, timeout_s: float = 20.0) -> None:
        self.base_url = (base_url or os.getenv("SEARXNG_URL", "")).rstrip("/")
        self.timeout_s = timeout_s

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    def search(self, query: str, max_results: int = 5) -> list[Source]:
        if not self.configured:
            return []
        with httpx.Client(timeout=self.timeout_s) as client:
            resp = client.get(
                f"{self.base_url}/search",
                params={"q": query, "format": "json", "language": "en"},
            )
            resp.raise_for_status()
            data = resp.json()
        out = []
        for i, r in enumerate(data.get("results", [])[:max_results]):
            url = r.get("url", "")
            out.append(
                Source(
                    url=url,
                    title=r.get("title", ""),
                    domain=urlparse(url).netloc,
                    snippet=r.get("content", "")[:2000],
                    relevance=float(max_results - i),
                )
            )
        return out
