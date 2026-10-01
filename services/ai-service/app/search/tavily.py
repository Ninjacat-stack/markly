"""Tavily search implementation. Needs TAVILY_API_KEY; otherwise inactive."""
from __future__ import annotations

import os
from urllib.parse import urlparse

import httpx

from .base import SearchProvider, Source


class TavilyProvider(SearchProvider):
    name = "tavily"

    def __init__(self, api_key: str | None = None, timeout_s: float = 20.0) -> None:
        self.api_key = api_key or os.getenv("TAVILY_API_KEY", "")
        self.timeout_s = timeout_s

    @property
    def configured(self) -> bool:
        return bool(self.api_key)

    def search(self, query: str, max_results: int = 5) -> list[Source]:
        if not self.configured:
            return []
        with httpx.Client(timeout=self.timeout_s) as client:
            resp = client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": self.api_key,
                    "query": query,
                    "max_results": max_results,
                    "search_depth": "advanced",
                    "include_answer": False,
                },
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
                    relevance=float(r.get("score", 0.0) or (max_results - i)),
                )
            )
        return out
