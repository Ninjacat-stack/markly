"""Qwen implementation over an OpenAI-compatible chat-completions gateway.

Config comes ONLY from environment:
  LLM_BASE_URL, LLM_API_KEY, LLM_MODEL
No hard-coded model ids, sizes, or hardware assumptions.
"""
from __future__ import annotations

import os
from typing import Any

import httpx

from .base import LLMProvider


class QwenProvider(LLMProvider):
    name = "qwen-openai-compatible"

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str | None = None,
        timeout_s: float = 60.0,
    ) -> None:
        self.base_url = (base_url or os.getenv("LLM_BASE_URL", "")).rstrip("/")
        self.api_key = api_key or os.getenv("LLM_API_KEY", "")
        self.model = model or os.getenv("LLM_MODEL", "")
        self.timeout_s = timeout_s

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.api_key and self.model)

    def generate(self, prompt: str, system: str | None = None, **kwargs: Any) -> str:
        if not self.configured:
            raise RuntimeError(
                "LLM gateway not configured (set LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)"
            )
        url = f"{self.base_url}/chat/completions"
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.4),
            "max_tokens": kwargs.get("max_tokens", 2500),
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        with httpx.Client(timeout=self.timeout_s) as client:
            resp = client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        try:
            return data["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"Unexpected gateway response shape: {data!r}") from exc
