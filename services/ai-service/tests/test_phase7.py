"""Phase 7 tests: SQL parsing + sandbox graceful degradation."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

for key in ("LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"):
    os.environ.pop(key, None)

import app.sandbox as sandbox  # noqa: E402
from app.codecheck import check_assignment_code, check_sql  # noqa: E402


def test_valid_sql_passes():
    out = check_sql("SELECT a, b FROM emp WHERE sal > (SELECT AVG(sal) FROM emp);")
    assert out["ok"] and out["statements"] == 1, out


def test_broken_sql_fails():
    out = check_sql("SELECT FROM WHERE (((;")
    assert not out["ok"] and out["errors"], out


def test_assignment_sql_gate():
    good = {"steps": [{"number": 1, "code": "SELECT 1;", "language": "sql"}]}
    report = check_assignment_code(good, {"validation": {"sql": True}})
    assert report["sql"]["checked"] == 1
    bad = {"steps": [{"number": 1, "code": "SELECT FROM WHERE (((;", "language": "sql"}]}
    try:
        check_assignment_code(bad, {"validation": {"sql": True}})
    except ValueError as exc:
        assert "step 1" in str(exc)
        return
    raise AssertionError("expected broken SQL to raise")


def test_non_sql_subjects_skipped():
    report = check_assignment_code({"steps": []}, {"validation": {}})
    assert report == {}


def test_sandbox_graceful_without_runtime():
    sandbox.DOCKER_BIN = "definitely-not-docker-xyz"
    try:
        out = sandbox.run_in_sandbox("alpine", ["echo", "hi"])
        assert out["ok"] is False and "error" in out and out["error"]
    finally:
        import importlib

        importlib.reload(sandbox)


if __name__ == "__main__":
    test_valid_sql_passes()
    print("ok - valid sql")
    test_broken_sql_fails()
    print("ok - broken sql")
    test_assignment_sql_gate()
    print("ok - assignment gate")
    test_non_sql_subjects_skipped()
    print("ok - skip")
    test_sandbox_graceful_without_runtime()
    print("ok - sandbox")
    print("ALL PHASE-7 TESTS PASSED")
