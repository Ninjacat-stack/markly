"""Subject code checks. Phase 7 ships SQL parsing; the same shape fits
future DSA compile checks, DLDCA truth tables, and AWS doc consistency."""
from __future__ import annotations

from typing import Any


def check_sql(code: str) -> dict[str, Any]:
    """Parse SQL without executing it. Returns {ok, errors, statements}."""
    import sqlglot
    from sqlglot.errors import ParseError

    statements = [s for s in code.split(";") if s.strip()]
    if not statements:
        return {"ok": False, "errors": ["empty SQL block"], "statements": 0}
    errors: list[str] = []
    parsed = 0
    for stmt in statements:
        try:
            sqlglot.parse_one(stmt)
            parsed += 1
        except ParseError as exc:
            errors.append(str(exc.errors[0]) if exc.errors else str(exc)[:200])
        except Exception as exc:  # noqa: BLE001
            errors.append(str(exc)[:200])
    return {"ok": not errors, "errors": errors, "statements": parsed}


def check_assignment_code(content: dict[str, Any], profile: dict | None) -> dict[str, Any]:
    """Validate code blocks per subject profile. Raises ValueError on hard failures."""
    report: dict[str, Any] = {}
    validation = (profile or {}).get("validation", {})
    if validation.get("sql"):
        per_step: dict[str, Any] = {}
        for step in content.get("steps", []):
            if ((step.get("language") or "").lower() == "sql") and (step.get("code") or "").strip():
                result = check_sql(step["code"])
                per_step[f"step_{step['number']}"] = result
                if not result["ok"]:
                    raise ValueError(f"SQL parse error in step {step['number']}: {result['errors'][:2]}")
        report["sql"] = {"checked": len(per_step), "steps": per_step} if per_step else {"checked": 0, "note": "no SQL blocks present"}
    return report
