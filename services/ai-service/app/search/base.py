"""Search provider abstraction. Business logic never touches a vendor SDK."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime, timezone

from pydantic import BaseModel, Field


class Source(BaseModel):
    url: str
    title: str = ""
    domain: str = ""
    snippet: str = ""
    content: str = ""
    retrievedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    relevance: float = 0.0


class SearchProvider(ABC):
    name: str = "base"

    @abstractmethod
    def search(self, query: str, max_results: int = 5) -> list[Source]:
        raise NotImplementedError
