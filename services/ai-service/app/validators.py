"""Validation layers for Phase 1: schema + required sections + consistency."""
from __future__ import annotations

from typing import Any

from .schemas import AssignmentContent

BANNED_PHRASES = ("viva", "viva-voce", "viva voce")


def validate_assignment(data: dict[str, Any], subject_profile: dict | None = None) -> dict[str, Any]:
    """Parse with Pydantic then run semantic checks.

    Hard failures (viva content, bad numbering, empty sections) raise ValueError.
    Soft findings (e.g. a code subject with no code blocks — the model may
    legitimately omit code when facts are unavailable) are returned as warnings
    so generation succeeds and the UI can surface them.
    """
    content = AssignmentContent.model_validate(data)
    errors: list[str] = []
    warnings: list[str] = []

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
        errors.append("viva questions are out of scope and must not be generated")

    numbers = [s.number for s in content.steps]
    if numbers != list(range(1, len(numbers) + 1)):
        errors.append(f"steps must be numbered 1..n sequentially, got {numbers}")

    for s in content.steps:
        if not s.description or any(len(d.strip()) < 4 for d in s.description):
            errors.append(f"step {s.number} has an empty/too-short description entry")

    if subject_profile and subject_profile.get("requiresCode"):
        langs = [str(x).lower() for x in subject_profile.get("languages", [])]
        has_code = any((s.code or "").strip() for s in content.steps)
        if not has_code:
            warnings.append(
                f"subject expects code ({'/'.join(langs) or 'code'}) but no step contains code; "
                "verify whether code was unavailable"
            )

    if errors:
        raise ValueError("; ".join(errors))

    return {
        "schema": "ok",
        "requiredSections": "ok",
        "consistency": "ok",
        "code": "checked" if subject_profile and subject_profile.get("requiresCode") else "skipped",
        "warnings": warnings,
    }
