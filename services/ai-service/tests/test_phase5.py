"""Phase 5 tests: research layer degrades gracefully with no providers/keys."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

for key in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL", "TAVILY_API_KEY", "SEARXNG_URL"):
    os.environ.pop(key, None)

from app.pipeline import generate_assignment  # noqa: E402
from app.schemas import GenerateRequest  # noqa: E402
from app.search.extract import strip_html  # noqa: E402
from app.search.research import run_research, select_search_provider  # noqa: E402


def test_no_provider_when_unconfigured():
    assert select_search_provider() is None


def test_research_skipped_without_subject_need():
    out = run_research("DSA", "Stacks", None, requires_research=False)
    assert out["sources"] == [] and out["context"] == ""


def test_research_empty_without_provider():
    out = run_research("DBMS", "Subqueries", None, requires_research=True)
    assert out["sources"] == []
    assert "no search provider" in out["provider"]


def test_html_stripping_drops_scripts():
    html = "<html><head><script>evil()</script><style>.x{}</style></head><body><h1>Aim lock</h1><p>Text here</p></body></html>"
    text = strip_html(html)
    assert "evil" not in text
    assert "Aim lock" in text and "Text here" in text


def test_pipeline_carries_sources_field():
    req = GenerateRequest(aim="Explore subqueries in SQL", subject="DBMS")
    result = generate_assignment(req)
    assert result["sources"] == []
    assert "researchProvider" in result


if __name__ == "__main__":
    test_no_provider_when_unconfigured()
    print("ok - provider selection")
    test_research_skipped_without_subject_need()
    print("ok - skip when unneeded")
    test_research_empty_without_provider()
    print("ok - empty without keys")
    test_html_stripping_drops_scripts()
    print("ok - html stripping")
    test_pipeline_carries_sources_field()
    print("ok - pipeline sources")
    print("ALL PHASE-5 TESTS PASSED")
