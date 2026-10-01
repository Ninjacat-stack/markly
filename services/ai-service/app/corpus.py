"""Assignment corpus: PDF ingestion -> normalized examples -> keyword retrieval.

Phase 6 uses simple subject + keyword-overlap retrieval. Embeddings/Qdrant plug
in here later behind the same retrieve_examples() signature.
"""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

STOPWORDS = frozenset(
    "a an the and or of to in on for with is are was were be by as at from that this it its into over under over under".split()
)

HEADINGS = {
    "aim": ("aim",),
    "objectives": ("objective", "objectives"),
    "theory": ("theory", "background", "concept"),
    "steps": ("procedure", "steps", "step", "observation", "program", "code", "execution", "commands"),
    "conclusion": ("conclusion",),
}

CORPUS_DIR = Path(__file__).resolve().parents[1] / "corpus"


def extract_pdf_text(path: str | Path) -> str:
    from pypdf import PdfReader

    reader = PdfReader(str(path))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def _heading_key(line: str) -> str | None:
    clean = re.sub(r"^[\d.\s\-•*)]+", "", line.strip().lower()).strip(" :.-")
    for key, words in HEADINGS.items():
        if any(clean == w or clean.startswith(w + " ") or clean.startswith(w + ":") for w in words):
            return key
    return None


def split_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {"preamble": []}
    current = "preamble"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        key = _heading_key(line)
        if key and len(line) < 80:
            current = key
            sections.setdefault(current, [])
            rest = re.split(r":", line, maxsplit=1)
            if len(rest) == 2 and rest[1].strip():
                sections[current].append(rest[1].strip())
            continue
        sections.setdefault(current, []).append(line)
    return sections


def _bullets(lines: list[str]) -> list[str]:
    items = []
    for ln in lines:
        parts = re.split(r"\n|;|•", ln)
        for p in parts:
            p = re.sub(r"^[\d.\s\-•*)>]+", "", p.strip())
            if len(p) >= 4:
                items.append(p)
    return items


def normalize_assignment(filename: str, text: str, subject: str = "") -> dict:
    """Best-effort normalization. Never invents content; missing parts stay empty."""
    sections = split_sections(text)
    preamble = sections.get("preamble", [])
    title = next((ln for ln in preamble if len(ln) >= 4), filename)
    aim_lines = sections.get("aim", [])
    objectives = _bullets(sections.get("objectives", []))[:10]
    theory = [ln for ln in sections.get("theory", []) if len(ln) >= 10][:20]
    step_lines = sections.get("steps", [])
    steps, n = [], 0
    for ln in step_lines:
        m = re.match(r"^(?:step\s*)?(\d+)[.\):\-]\s*(.+)", ln, re.IGNORECASE)
        if m:
            n += 1
            steps.append({"number": n, "title": m.group(2)[:200], "description": [m.group(2)], "code": None, "language": None})
        elif steps:
            steps[-1]["description"].append(ln)
    conclusion = " ".join(sections.get("conclusion", []))
    return {
        "id": uuid.uuid4().hex[:12],
        "sourceFile": filename,
        "subject": subject,
        "content": {
            "experimentNumber": None,
            "title": title[:200],
            "aim": " ".join(aim_lines)[:2000] or title[:2000],
            "objectives": objectives or ["(objectives not detected)"],
            "theory": theory or ["(theory not detected)"],
            "steps": steps or [{"number": 1, "title": "(steps not detected)", "description": ["(see original PDF)"], "code": None, "language": None}],
            "conclusion": conclusion[:2000] or "(conclusion not detected)",
            "metadata": {"ingested": True},
        },
    }


def save_example(example: dict) -> Path:
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    path = CORPUS_DIR / f"{example['id']}.json"
    path.write_text(json.dumps(example, ensure_ascii=False, indent=2), encoding="utf-8")
    return path


def load_examples() -> list[dict]:
    if not CORPUS_DIR.exists():
        return []
    out = []
    for p in CORPUS_DIR.glob("*.json"):
        try:
            out.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception:
            continue
    return out


def _tokens(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in STOPWORDS}


def retrieve_examples(subject: str, query: str, k: int = 2) -> list[dict]:
    """Keyword-overlap retrieval. Same-subject examples rank first."""
    examples = load_examples()
    if not examples:
        return []
    qtok = _tokens(f"{subject} {query}")
    scored = []
    for ex in examples:
        c = ex.get("content", {})
        hay = " ".join([c.get("title", ""), c.get("aim", ""), " ".join(c.get("theory", [])[:3])])
        overlap = len(qtok & _tokens(hay))
        same = 1 if (ex.get("subject", "").lower() == subject.lower() and subject) else 0
        if overlap or same:
            scored.append((same * 100 + overlap, ex))
    scored.sort(key=lambda x: -x[0])
    return [ex for _, ex in scored[:k]]
