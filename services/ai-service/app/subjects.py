"""Subject profile lookup. Config-driven; never embedded in prompt strings."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

DEFAULT_PROFILE = {
    "requiresCode": False,
    "languages": [],
    "requiresResearch": False,
    "validation": {},
}

# __file__ = <root>/services/ai-service/app/subjects.py, so parents[3] is the repo root.
_REPO_ROOT = Path(__file__).resolve().parents[3]
CANDIDATE_PATHS = [
    Path(os.getenv("SUBJECT_PROFILES_PATH", "")) if os.getenv("SUBJECT_PROFILES_PATH") else None,
    _REPO_ROOT / "packages" / "shared" / "subject-profiles.json",
]


@lru_cache(maxsize=1)
def load_profiles() -> dict:
    for p in CANDIDATE_PATHS:
        if p and p.exists():
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
