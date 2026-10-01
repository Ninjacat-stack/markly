"""Validation layers for Phase 1: schema + required sections + consistency."""
from __future__ import annotations

from typing import Any

from .schemas import AssignmentContent

BANNED_PHRASES = ("viva", "viva-voce", "viva voce")


def validate_assignment(data: dict[str, Any], subject_profile: dict | None = None) -> dict[str, Any]:
    """Parse with Pydantic then run semantic checks. Raises ValueError on failure."""
    content = AssignmentContent.model_validate(data)
    issues: list[str] = []

    blob = " ".join(
        [
            content.title,
            content.aim,
            " ".join(content.objectives),
            " ".join(content.theory),
            content.conclusion,
        ]
    ).lower()
    if any(p in blob for p in BANNED_PHRASES):
        issues.append("viva questions are out of scope and must not be generated")

    numbers = [s.number for s in content.steps]
    if numbers != list(range(1, len(numbers) + 1)):
        issues.append(f"steps must be numbered 1..n sequentially, got {numbers}")

    for s in content.steps:
        if not s.description or any(len(d.strip()) < 4 for d in s.description):
            issues.append(f"step {s.number} has an empty/too-short description entry")

    if subject_profile and subject_profile.get("requiresCode"):
        langs = [str(x).lower() for x in subject_profile.get("languages", [])]
        has_code = any((s.code or "").strip() for s in content.steps)
        # Phase 1: warn-level only (LLM may legitimately omit code when facts unknown).
        # Record as info so callers can surface it without failing validation.
        if not has_code:
            issues.append(
                f"subject expects code ({'/'.join(langs) or 'code'}) but no step contains code; "
                "verify whether code was unavailable"
            )

    if issues:
        raise ValueError("; ".join(issues))

    return {
        "schema": "ok",
        "requiredSections": "ok",
        "consistency": "ok",
        "code": "checked" if subject_profile and subject_profile.get("requiresCode") else "skipped",
    }
