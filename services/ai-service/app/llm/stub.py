"""Deterministic fallback used when the LLM gateway is not configured.

Clearly marked as a stub so output is never mistaken for model output.
Builds a well-formed structure from the user's aim without inventing
fake schemas, results, or benchmarks.
"""
from __future__ import annotations

from .base import LLMProvider


class StubProvider(LLMProvider):
    name = "stub"

    def generate(self, prompt: str, system: str | None = None, **kwargs) -> str:
        import json

        aim = str(kwargs.get("aim") or "General engineering practical").strip()
        subject = str(kwargs.get("subject") or "General").strip()
        tech = str(kwargs.get("technology") or "").strip()
        exp = kwargs.get("experimentNumber")
        title = aim[:160] if len(aim) > 4 else f"{subject} practical"
        doc = {
            "experimentNumber": exp,
            "title": title,
            "aim": aim,
            "objectives": [
                f"Understand the core concepts behind: {aim}",
                "Apply standard procedure and tools to demonstrate the aim",
                "Record observations and conclude the outcome",
            ],
            "theory": [
                f"This practical belongs to {subject}. "
                "Background concepts, definitions and standard procedure relevant to the aim are studied before performing the steps."
                + (f" Technology focus: {tech}." if tech else ""),
                "The procedure is carried out using authoritative references and lab instructions; where factual details are unavailable they are left as explicit placeholders for the student to fill from observed results.",
            ],
            "steps": [
                {
                    "number": 1,
                    "title": "Study and preparation",
                    "description": [
                        "Review the concepts and prerequisites for the aim.",
                        "Keep references and lab manual ready.",
                    ],
                    "code": None,
                    "language": None,
                },
                {
                    "number": 2,
                    "title": "Perform the procedure",
                    "description": [
                        "Carry out the experiment as per lab instructions.",
                        "Record queries, commands or observations actually executed (do not fabricate results).",
                    ],
                    "code": None,
                    "language": None,
                },
                {
                    "number": 3,
                    "title": "Verify and conclude",
                    "description": [
                        "Verify outputs against expected behavior.",
                        "Note deviations explicitly instead of inventing results.",
                    ],
                    "code": None,
                    "language": None,
                },
            ],
            "conclusion": "The aim was studied and the standard procedure was documented. Observed results should be filled in from actual execution.",
            "metadata": {"provider": "stub", "note": "Gateway not configured; deterministic placeholder."},
        }
        return json.dumps(doc)
