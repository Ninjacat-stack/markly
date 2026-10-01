"""Phase 8 tests: template analyze endpoint (fixture PDF, no network)."""
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def make_pdf(path: Path) -> None:
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen.canvas import Canvas

    c = Canvas(str(path), pagesize=A4)
    y = 800
    for line in [
        "TCET Computer Engineering Practical Format",
        "Aim: Demonstrate practical documentation structure.",
        "Objectives:",
        "1. Follow a consistent format.",
        "Theory:",
        "Structure helps evaluation and reuse across batches.",
        "Procedure:",
        "1. Write the aim clearly.",
        "Conclusion:",
        "A consistent format was followed.",
    ]:
        c.drawString(50, y, line)
        y -= 24
    c.save()


def test_analyze_template():
    tmp = Path(tempfile.gettempdir()) / "tmpl-fixture.pdf"
    make_pdf(tmp)
    try:
        with TestClient(app) as client:
            with open(tmp, "rb") as fh:
                r = client.post("/v1/analyze-template", files={"file": ("sample.pdf", fh, "application/pdf")})
        assert r.status_code == 200, r.text
        draft = r.json()
        assert "Practical Format" in draft["suggestedName"]
        for h in ("aim", "objectives", "theory", "steps", "conclusion"):
            assert h in draft["detectedHeadings"], draft
        assert draft["requiredSections"][0] == "title"
    finally:
        tmp.unlink(missing_ok=True)


def test_analyze_rejects_non_pdf():
    with TestClient(app) as client:
        r = client.post("/v1/analyze-template", files={"file": ("evil.exe", b"MZ", "application/octet-stream")})
    assert r.status_code == 400


if __name__ == "__main__":
    test_analyze_template()
    print("ok - analyze")
    test_analyze_rejects_non_pdf()
    print("ok - reject non-pdf")
    print("ALL PHASE-8 TESTS PASSED")
