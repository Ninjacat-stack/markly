"""Research orchestration: plan one query -> search -> extract -> context."""
from __future__ import annotations

from .base import SearchProvider, Source
from .extract import fetch_text
from .searxng import SearXNGProvider
from .tavily import TavilyProvider

MAX_SOURCES = 3


def select_search_provider() -> SearchProvider | None:
    """Tavily first (higher quality), SearXNG fallback. None when unconfigured."""
    tavily = TavilyProvider()
    if tavily.configured:
        return tavily
    searxng = SearXNGProvider()
    if searxng.configured:
        return searxng
    return None


def run_research(subject: str, aim: str, description: str | None, requires_research: bool) -> dict:
    """Returns {sources: [Source...], context: str, provider: str}."""
    if not requires_research:
        return {"sources": [], "context": "", "provider": "none (subject needs no research)"}
    provider = select_search_provider()
    if provider is None:
        return {"sources": [], "context": "", "provider": "none (no search provider configured)"}
    query = f"{subject} {aim} {description or ''}".strip()[:300]
    try:
        hits = provider.search(query, max_results=MAX_SOURCES)
    except Exception as exc:  # search must never break generation
        return {"sources": [], "context": "", "provider": f"{provider.name} (search failed: {exc})"}
    sources: list[Source] = []
    for h in hits:
        h.content = fetch_text(h.url)
        sources.append(h)
    usable = [s for s in sources if s.content or s.snippet]
    context = "\n\n".join(
        f"[Source {i+1}: {s.title} <{s.url}>]\n{s.content or s.snippet}" for i, s in enumerate(usable)
    )
    return {"sources": [s.model_dump() for s in sources], "context": context, "provider": provider.name}
