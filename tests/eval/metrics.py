"""Deterministic behavioral metric for the P1A diverse-bundle workflow."""

from __future__ import annotations

import json
from typing import Any


def evaluate(instance: dict[str, Any]) -> dict[str, int | str]:
    """Require a typed three-strategy bundle from the generated final response."""
    raw_response: Any = instance.get("response", "")
    if isinstance(raw_response, dict):
        parts = raw_response.get("parts", [])
        if isinstance(parts, list) and parts and isinstance(parts[0], dict):
            raw_response = parts[0].get("text", "")
    try:
        payload = json.loads(str(raw_response))
        plans = payload["plans"]
    except (KeyError, ValueError, TypeError) as error:
        return {"score": 0, "explanation": f"invalid CandidateSet: {error}"}

    expected = {"deadline-first", "risk-minimization-first", "resource-balance-first"}
    strategies = {plan.get("strategy_type") for plan in plans}
    typed = all(
        isinstance(plan.get("plan_id"), str)
        and isinstance(plan.get("actions"), list)
        and plan.get("actions")
        for plan in plans
    )
    if len(plans) != 3 or strategies != expected or not typed:
        return {
            "score": 0,
            "explanation": "response did not contain exactly one plan per required strategy",
        }
    return {
        "score": 1,
        "explanation": "typed bundle contains deadline, risk, and resource strategies",
    }
