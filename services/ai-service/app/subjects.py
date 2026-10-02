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

# Dev layout: <root>/services/ai-service/app/subjects.py → walk up to the repo
# root that holds packages/shared/subject-profiles.json. Containers don't ship
# the repo root, so SUBJECT_PROFILES_PATH points at the mounted copy instead
# and this search simply finds nothing (returning "/" as a harmless fallback).
def _find_repo_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        if (parent / "packages" / "shared" / "subject-profiles.json").exists():
            return parent
    return Path("/")


CANDIDATE_PATHS = [
    Path(os.environ["SUBJECT_PROFILES_PATH"]) if os.getenv("SUBJECT_PROFILES_PATH") else None,
    _find_repo_root() / "packages" / "shared" / "subject-profiles.json",
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
