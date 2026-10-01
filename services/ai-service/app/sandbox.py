"""Sandboxed code execution. NEVER runs untrusted code on the host.

Everything executes inside a one-shot, network-isolated, memory/CPU-capped
container. No HTTP endpoint exposes this (arbitrary-exec-as-a-service would be
a remote-code-execution hole); callers are internal validators only.
"""
from __future__ import annotations

import os
import subprocess

DOCKER_BIN = os.getenv("SANDBOX_DOCKER", "docker")


def docker_available() -> bool:
    try:
        subprocess.run([DOCKER_BIN, "info"], capture_output=True, timeout=10)
        return True
    except Exception:
        return False


def run_in_sandbox(image: str, command: list[str], stdin_data: str = "", timeout_s: int = 30) -> dict:
    """Run `command` in `image` with no network, 256MB RAM, 0.5 CPU. Dict result, never raises."""
    if not docker_available():
        return {"ok": False, "error": "no container runtime available (set SANDBOX_DOCKER)", "stdout": "", "stderr": ""}
    try:
        proc = subprocess.run(
            [DOCKER_BIN, "run", "--rm", "--network", "none", "--memory", "256m", "--cpus", "0.5", "-i", image, *command],
            input=stdin_data,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        return {"ok": proc.returncode == 0, "stdout": proc.stdout[-4000:], "stderr": proc.stderr[-4000:], "error": ""}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"sandbox timeout after {timeout_s}s", "stdout": "", "stderr": ""}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": str(exc)[:300], "stdout": "", "stderr": ""}
