"""FastAPI entrypoint for the AI service (Phase 1: generation only, no search/RAG)."""
from __future__ import annotations

import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from .pipeline import generate_assignment  # noqa: E402
from .prompts import PROMPT_VERSION  # noqa: E402
from .schemas import GenerateRequest, GenerateResponse  # noqa: E402

app = FastAPI(title="AssignmentAI AI Service", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    provider: str
    model: str
    promptVersion: str


def _provider_info() -> tuple[str, str]:
    if os.getenv("LLM_BASE_URL") and os.getenv("LLM_API_KEY") and os.getenv("LLM_MODEL"):
        return "qwen-openai-compatible", os.getenv("LLM_MODEL", "")
    return "stub", os.getenv("LLM_MODEL", "stub")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    provider, model = _provider_info()
    return HealthResponse(status="ok", provider=provider, model=model, promptVersion=PROMPT_VERSION)


@app.post("/v1/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        result = generate_assignment(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return GenerateResponse(**result)
