"""Phase 1 tests: schema + validators + pipeline (stub provider, no network)."""
import os
import sys
from pathlib import Path

# Ensure `import app...` works when running `python -m pytest` or plain python.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Force stub provider (no gateway).
for key in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
    os.environ.pop(key, None)

from app.pipeline import _extract_json, generate_assignment  # noqa: E402
from app.schemas import GenerateRequest  # noqa: E402
from app.validators import validate_assignment  # noqa: E402


def test_extract_json_strips_fences():
    data = _extract_json('```json\n{"a": 1}\n```')
    assert data == {"a": 1}


def test_rejects_viva_content():
    bad = {
        "experimentNumber": 1,
        "title": "Subqueries in SQL",
        "aim": "Explore subqueries in SQL",
        "objectives": ["Learn subqueries"],
        "theory": ["Subqueries are nested queries."],
        "steps": [{"number": 1, "title": "Do it", "description": ["Run queries"], "code": None, "language": None}],
        "conclusion": "Done, viva questions below",
        "metadata": {},
    }
    # conclusion mentions viva -> must fail
    bad["conclusion"] = "Viva questions: what is a subquery?"
    try:
        validate_assignment(bad, {"requiresCode": False})
    except ValueError as exc:
        assert "viva" in str(exc).lower()
        return
    raise AssertionError("expected viva content to be rejected")


def test_pipeline_stub_produces_valid_assignment():
    req = GenerateRequest(aim="Explore subqueries in SQL", subject="UHV", experimentNumber=7)
    result = generate_assignment(req)
    content = result["content"]
    assert content["aim"] == "Explore subqueries in SQL"
    assert content["experimentNumber"] == 7
    assert len(content["objectives"]) >= 1
    assert len(content["theory"]) >= 1
    assert len(content["steps"]) >= 1
    assert result["provider"] == "stub"
    assert result["validation"]["schema"] == "ok"


if __name__ == "__main__":
    test_extract_json_strips_fences()
    print("ok - fences")
    test_rejects_viva_content()
    print("ok - viva rejection")
    test_pipeline_stub_produces_valid_assignment()
    print("ok - pipeline stub")
    print("ALL AI-SERVICE TESTS PASSED")
