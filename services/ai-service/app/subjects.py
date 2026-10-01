"""Subject profile lookup. Config-driven; never embedded in prompt strings."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DEFAULT_PROFILE = {
    "requiresCode": False,
    "languages": [],
    "requiresResearch": False,
    "validation": {},
}

CANDIDATE_PATHS = [
    Path(__file__).resolve().parents[2] / "packages" / "shared" / "subject-profiles.json",
    Path(__file__).resolve().parents[1] / "subject-profiles.json",
]


@lru_cache(maxsize=1)
def load_profiles() -> dict:
    for p in CANDIDATE_PATHS:
        if p.exists():
            return json.loads(p.read_text(encoding="utf-8"))
    return {"subjects": {}}


def get_subject_profile(subject: str) -> dict:
    profiles = load_profiles()
    subjects = profiles.get("subjects", {})
    # Case-insensitive fallback so "dbms" still resolves.
    for key, value in subjects.items():
        if key.lower() == (subject or "").lower():
            return value
    return subjects.get(subject, DEFAULT_PROFILE)
