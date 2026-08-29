"""Deterministic formal grader for validated P2I traces."""

import json
import re
from typing import Any


def _text(value: Any) -> str:
    if not isinstance(value, dict):
        return ""
    response = value.get("response", value)
    if not isinstance(response, dict):
        return ""
    parts = response.get("parts") or []
    return str(parts[0].get("text") or "") if parts and isinstance(parts[0], dict) else ""


def evaluate(instance: dict[str, Any]) -> float:
    try:
        response = json.loads(_text(instance.get("response")))
        case = json.loads(_text(instance.get("reference")))
        checks = response["checks"]
        passed = bool(response["passed"]) and all(checks.values())
        human = str(response.get("human_summary") or "")
        if re.search(r"\b([A-Za-z][\w'-]*)\s+\1\b", human, re.IGNORECASE):
            passed = False
        if case["mode"] == "HELP" and "clarif" in human.casefold():
            passed = False
        return 1.0 if passed else 0.0
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return 0.0
