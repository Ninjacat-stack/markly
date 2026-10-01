"""LLM provider abstraction. Swap Qwen/self-hosted/other APIs without touching pipeline."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class LLMProvider(ABC):
    name: str = "base"

    @abstractmethod
    def generate(self, prompt: str, system: str | None = None, **kwargs: Any) -> str:
        """Return raw text completion."""
        raise NotImplementedError

    def generate_structured(self, prompt: str, system: str | None = None, **kwargs: Any) -> str:
        """Return raw text expected to contain JSON. Default delegates to generate()."""
        return self.generate(prompt, system=system, **kwargs)
