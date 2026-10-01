"""FastAPI entrypoint for the AI service (Phase 1: generation only, no search/RAG)."""
from __future__ import annotations

import os
import tempfile
import uuid
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from .pipeline import generate_assignment  # noqa: E402
from .prompts import PROMPT_VERSION  # noqa: E402
from .schemas import GenerateRequest, GenerateResponse, RegenerateRequest, RegenerateResponse  # noqa: E402
from .sections import regenerate_section  # noqa: E402

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


@app.post("/v1/regenerate-section", response_model=RegenerateResponse)
def regenerate(req: RegenerateRequest) -> RegenerateResponse:
    try:
        return RegenerateResponse(**regenerate_section(req))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.post("/v1/ingest")
async def ingest(file: UploadFile = File(...), subject: str = "") -> dict:
    """Phase 6: upload a sample assignment PDF -> normalized example -> corpus."""
    from .corpus import extract_pdf_text, normalize_assignment, save_example

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf uploads are accepted")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large (25MB max)")
    tmp = Path(tempfile.gettempdir()) / f"ingest-{uuid.uuid4().hex}.pdf"
    tmp.write_bytes(raw)
    try:
        text = extract_pdf_text(tmp)
    finally:
        tmp.unlink(missing_ok=True)
    if len(text.strip()) < 50:
        raise HTTPException(status_code=422, detail="No extractable text found (scanned image PDF?)")
    example = normalize_assignment(file.filename, text, subject=subject)
    save_example(example)
    c = example["content"]
    return {
        "id": example["id"],
        "title": c["title"],
        "objectives": len(c["objectives"]),
        "theoryParagraphs": len(c["theory"]),
        "steps": len(c["steps"]),
    }


@app.get("/v1/examples")
def examples(subject: str = "", q: str = "", k: int = 2) -> dict:
    """Phase 6: retrieve relevant ingested examples."""
    from .corpus import retrieve_examples

    found = retrieve_examples(subject, q, k=max(1, min(k, 10)))
    return {"examples": [{"id": e["id"], "title": e["content"].get("title", ""), "subject": e.get("subject", "")} for e in found]}


@app.post("/v1/analyze-template")
async def analyze_template(file: UploadFile = File(...)) -> dict:
    """Phase 8: sample PDF -> template structure draft (user reviews before saving)."""
    from .corpus import extract_pdf_text, split_sections

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf uploads are accepted")
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="PDF too large (25MB max)")
    tmp = Path(tempfile.gettempdir()) / f"tmpl-{uuid.uuid4().hex}.pdf"
    tmp.write_bytes(raw)
    try:
        text = extract_pdf_text(tmp)
    finally:
        tmp.unlink(missing_ok=True)
    if len(text.strip()) < 50:
        raise HTTPException(status_code=422, detail="No extractable text found (scanned image PDF?)")
    sections = split_sections(text)
    detected = [k for k in ("aim", "objectives", "theory", "steps", "conclusion") if sections.get(k)]
    preamble = sections.get("preamble", [])
    suggested = next((ln for ln in preamble if 4 <= len(ln) <= 120), "Imported template")
    order = ["title", "aim", "objectives", "theory", "steps", "conclusion"]
    return {
        "suggestedName": suggested[:120],
        "detectedHeadings": detected,
        "requiredSections": [s for s in order if s in ("title", "conclusion") or s in detected],
        "chars": len(text),
    }
