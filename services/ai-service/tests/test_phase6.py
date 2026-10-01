"""Phase 6 tests: build a fixture PDF, ingest it, retrieve it."""
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

for key in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
    os.environ.pop(key, None)

import app.corpus as corpus  # noqa: E402
from app.corpus import extract_pdf_text, normalize_assignment, retrieve_examples, save_example  # noqa: E402


def make_pdf(path: Path) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen.canvas import Canvas

    c = Canvas(str(path), pagesize=A4)
    y = 800
    for line in [
        "Experiment 3: Single Row Subqueries in SQL",
        "Aim: Explore single row subqueries in SQL using the employee table.",
        "Objectives:",
        "1. Understand single row subquery syntax and semantics.",
        "2. Execute subqueries with comparison operators.",
        "Theory:",
        "A single row subquery returns exactly one row for the outer query to consume.",
        "It is typically used with single-row comparison operators in the WHERE clause.",
        "Procedure:",
        "1. Create the employee table with sample rows.",
        "2. Write a query using a subquery in the WHERE clause.",
        "3. Record the observed output without fabrication.",
        "Conclusion:",
        "Single row subqueries were studied and executed against sample data.",
    ]:
        c.drawString(50, y, line)
        y -= 22
    c.save()


def test_ingest_and_retrieve(tmp_path=None):
    tmp = Path(tempfile.gettempdir()) / "fixture-assign.pdf"
    make_pdf(tmp)
    # Isolate corpus for the test.
    corpus.CORPUS_DIR = Path(tempfile.mkdtemp(prefix="corpus-test-"))
    try:
        text = extract_pdf_text(tmp)
        assert "subquer" in text.lower()
        ex = normalize_assignment("fixture.pdf", text, subject="DBMS")
        assert "subquer" in ex["content"]["aim"].lower()
        assert len(ex["content"]["objectives"]) >= 2
        assert len(ex["content"]["theory"]) >= 1
        assert len(ex["content"]["steps"]) >= 3
        assert "studied and executed" in ex["content"]["conclusion"]
        save_example(ex)
        hits = retrieve_examples("DBMS", "subqueries in SQL")
        assert hits and hits[0]["id"] == ex["id"]
        misses = retrieve_examples("UHV", "human values harmony unrelated xyzzy")
        assert all(h["id"] != ex["id"] for h in misses)
    finally:
        tmp.unlink(missing_ok=True)
    print("ok - ingest + retrieve")


if __name__ == "__main__":
    test_ingest_and_retrieve()
    print("ALL PHASE-6 TESTS PASSED")
