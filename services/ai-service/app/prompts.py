"""Versioned prompts. Bump PROMPT_VERSION when the template changes."""
PROMPT_VERSION = "v1.0.0"

SYSTEM_PROMPT = """You generate structured academic CONTENT for engineering practicals.
Return ONLY valid JSON matching the requested schema. No markdown, no commentary.
Rules:
- Do NOT invent database schemas, API behavior, execution results, benchmarks, or AWS outputs.
- Where facts are unavailable, use explicit placeholders like "TO BE FILLED FROM OBSERVED OUTPUT".
- Never include viva questions (out of scope for this product version).
- Theory must be conceptual paragraphs. Steps must be ordered with number/title/description.
- Description fields are arrays of strings.
"""

USER_TEMPLATE = """Generate an engineering practical document as JSON with exactly these keys:
experimentNumber (int or null), title, aim, objectives (string[]), theory (string[]),
steps (array of {{number, title, description: string[], code: string|null, language: string|null}}),
conclusion, metadata (object).

Constraints:
- Subject: {subject}
- Aim: {aim}
- Description: {description}
- Experiment number: {experimentNumber}
- Technology/language: {technology}
- Difficulty: {difficulty}
- Additional instructions: {additionalInstructions}
- Subject profile: requiresCode={requiresCode}, languages={languages}

Return JSON only.
"""


def build_user_prompt(**kwargs) -> str:
    def norm(v):
        return v if v not in (None, "") else "n/a"

    return USER_TEMPLATE.format(
        subject=norm(kwargs.get("subject")),
        aim=norm(kwargs.get("aim")),
        description=norm(kwargs.get("description")),
        experimentNumber=norm(kwargs.get("experimentNumber")),
        technology=norm(kwargs.get("technology")),
        difficulty=norm(kwargs.get("difficulty")),
        additionalInstructions=norm(kwargs.get("additionalInstructions")),
        requiresCode=kwargs.get("requiresCode", False),
        languages=",".join(kwargs.get("languages", []) or []) or "none",
    )
