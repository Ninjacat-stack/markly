"""Single-section regeneration (Phase 3). Everything else stays untouched."""
from __future__ import annotations

import json
from typing import Any

from .pipeline import _extract_json, select_provider
from .prompts import PROMPT_VERSION, SYSTEM_PROMPT
from .schemas import AssignmentContent, RegenerateRequest
from .subjects import get_subject_profile

SECTION_HINTS = {
    "title": "a string (4-200 chars)",
    "aim": "a string (4-2000 chars)",
    "objectives": "an array of 1-10 strings",
    "theory": "an array of 1-20 paragraph strings",
    "steps": 'an array of {number, title, description: string[], code: string|null, language: string|null} with sequential numbers from 1',
    "conclusion": "a string (10-2000 chars)",
}


def _validate_section(section: str, value: Any) -> Any:
    """Validate a regenerated value by stuffing it into a copy of a doc."""
    if section == "steps":
        steps = AssignmentContent.model_validate(
            {
                "experimentNumber": None,
                "title": "Placeholder Title",
                "aim": "Placeholder aim for validation",
                "objectives": ["Placeholder objective"],
                "theory": ["Placeholder theory paragraph for validation."],
                "steps": value,
                "conclusion": "Placeholder conclusion for validation.",
                "metadata": {},
            }
        ).steps
        return [s.model_dump() for s in steps]
    if section in ("objectives", "theory"):
        if not isinstance(value, list) or not value or not all(isinstance(x, str) for x in value):
            raise ValueError(f"{section} must be a non-empty array of strings")
        return value
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{section} must be a non-empty string")
    return value


def regenerate_section(req: RegenerateRequest) -> dict[str, Any]:
    provider, provider_name, model = select_provider()
    profile = get_subject_profile(req.subject)
    context = req.current.model_dump()

    if provider_name == "stub":
        # Deterministic: regenerate via the full stub pipeline, keep one section.
        from .pipeline import generate_assignment
        from .schemas import GenerateRequest

        full = generate_assignment(
            GenerateRequest(aim=req.aim, subject=req.subject, experimentNumber=context.get("experimentNumber"))
        )["content"]
        return {
            "section": req.section,
            "value": _validate_section(req.section, full[req.section]),
            "provider": provider_name,
            "model": model,
            "promptVersion": PROMPT_VERSION,
        }

    prompt = (
        f"Subject: {req.subject}\nAim: {req.aim}\n"
        f"Current document (context, do not repeat it):\n{json.dumps(context)[:4000]}\n"
        f"Subject profile: requiresCode={profile.get('requiresCode', False)}\n"
        f"Additional instructions: {req.additionalInstructions or 'n/a'}\n\n"
        f"Regenerate ONLY the '{req.section}' section as {SECTION_HINTS[req.section]}. "
        'Return ONLY JSON of the form {"value": <new section value>}. No viva questions.'
    )
    last_error: Exception | None = None
    for attempt in range(2):
        raw = provider.generate_structured(
            prompt if attempt == 0 else prompt + "\nPrevious output failed validation. Return ONLY corrected JSON.",
            system=SYSTEM_PROMPT,
        )
        try:
            data = _extract_json(raw)
            value = _validate_section(req.section, data.get("value", data.get(req.section)))
            return {
                "section": req.section,
                "value": value,
                "provider": provider_name,
                "model": model,
                "promptVersion": PROMPT_VERSION,
            }
        except Exception as exc:  # noqa: BLE001
            last_error = exc
    raise ValueError(f"section regeneration failed: {last_error}")
