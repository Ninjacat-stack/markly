"""Phase 3 tests: single-section regeneration (stub provider, no network)."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

for key in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
    os.environ.pop(key, None)

from app.pipeline import generate_assignment  # noqa: E402
from app.schemas import GenerateRequest, RegenerateRequest  # noqa: E402
from app.sections import regenerate_section  # noqa: E402


def _doc():
    req = GenerateRequest(aim="Explore subqueries in SQL", subject="DBMS", experimentNumber=7)
    return generate_assignment(req)["content"]


def test_regenerate_each_section_type():
    doc = _doc()
    for section in ("title", "aim", "objectives", "theory", "steps", "conclusion"):
        req = RegenerateRequest(section=section, aim=doc["aim"], subject="DBMS", current=doc)
        out = regenerate_section(req)
        assert out["section"] == section, section
        assert out["value"], f"empty value for {section}"
        if section in ("objectives", "theory"):
            assert isinstance(out["value"], list) and all(isinstance(x, str) for x in out["value"])
        elif section == "steps":
            assert isinstance(out["value"], list)
            assert [s["number"] for s in out["value"]] == list(range(1, len(out["value"]) + 1))
        else:
            assert isinstance(out["value"], str)


def test_regenerate_rejects_bad_section():
    doc = _doc()
    try:
        RegenerateRequest(section="viva", aim=doc["aim"], subject="DBMS", current=doc)
    except Exception:
        return
    raise AssertionError("expected section=viva to be rejected by schema")


if __name__ == "__main__":
    test_regenerate_each_section_type()
    print("ok - regenerate all sections")
    test_regenerate_rejects_bad_section()
    print("ok - bad section rejected")
    print("ALL PHASE-3 TESTS PASSED")
