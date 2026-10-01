"""Canonical Assignment schemas (Pydantic mirror of packages/shared/assignment.schema.json)."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

SubjectName = Literal["DBMS", "DSA", "UHV", "DLDCA", "Professional Skills / AWS"]


class AssignmentStep(BaseModel):
    number: int = Field(ge=1)
    title: str = Field(min_length=2, max_length=200)
    description: list[str] = Field(min_length=1, max_length=10)
    code: str | None = Field(default=None, max_length=8000)
    language: str | None = Field(default=None, max_length=32)


class AssignmentContent(BaseModel):
    """LLM generates content only. No layout, no viva questions."""

    model_config = {"extra": "forbid"}

    experimentNumber: int | None = Field(default=None, ge=1)
    title: str = Field(min_length=4, max_length=200)
    aim: str = Field(min_length=4, max_length=2000)
    objectives: list[str] = Field(min_length=1, max_length=10)
    theory: list[str] = Field(min_length=1, max_length=20)
    steps: list[AssignmentStep] = Field(min_length=1, max_length=15)
    conclusion: str = Field(min_length=10, max_length=2000)
    metadata: dict[str, Any] = Field(default_factory=dict)


class GenerateRequest(BaseModel):
    aim: str = Field(min_length=4, max_length=2000)
    description: str | None = Field(default=None, max_length=4000)
    subject: str = Field(default="DBMS", max_length=64)
    experimentNumber: int | None = Field(default=None, ge=1)
    technology: str | None = Field(default=None, max_length=64)
    difficulty: str | None = Field(default=None, max_length=32)
    additionalInstructions: str | None = Field(default=None, max_length=2000)


class GenerateResponse(BaseModel):
    content: AssignmentContent
    provider: str
    model: str
    promptVersion: str
    validation: dict[str, Any]
    sources: list[dict[str, Any]] = Field(default_factory=list)
    researchProvider: str = "none"


SECTION_NAMES = ("title", "aim", "objectives", "theory", "steps", "conclusion")


class RegenerateRequest(BaseModel):
    """Regenerate one section using the rest of the document as context."""

    section: str = Field(pattern="^(title|aim|objectives|theory|steps|conclusion)$")
    aim: str = Field(min_length=4, max_length=2000)
    subject: str = Field(default="DBMS", max_length=64)
    current: AssignmentContent
    additionalInstructions: str | None = Field(default=None, max_length=2000)


class RegenerateResponse(BaseModel):
    section: str
    value: Any
    provider: str
    model: str
    promptVersion: str
