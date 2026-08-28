"""Local agents-cli behavioral metric for validated P2F Operator responses."""

import json
from typing import Any


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if not isinstance(value, dict):
        return ""
    text = value.get("text")
    if isinstance(text, str):
        return text
    parts = value.get("parts") or []
    if parts and isinstance(parts[0], dict):
        return str(parts[0].get("text") or "")
    response = value.get("response")
    if isinstance(response, dict):
        parts = response.get("parts") or []
        if parts and isinstance(parts[0], dict):
            return str(parts[0].get("text") or "")
    return ""


def evaluate(instance: dict[str, Any]) -> float:
    try:
        response = json.loads(_text(instance.get("response")))
        case = json.loads(_text(instance.get("reference")))
        intent = response["intent"]
        fact_ids = [item["fact_id"] for item in response["facts"]]
        agents = {item["agent_id"] for item in response["agents"]}
        passed = (
            intent["intent_type"] == case["intent"]
            and response["disposition"] == case["disposition"]
            and response["external_effects_executed"] is False
            and "operator_intent_interpreter" in agents
            and all(
                any(fact_id.startswith(prefix) for fact_id in fact_ids)
                for prefix in case["required_fact_prefixes"]
            )
        )
        if case["intent"] == "SIMULATE":
            simulation = response.get("simulation") or {}
            passed = passed and (
                "simulation_agent" in agents
                and response["provenance"] == "HYPOTHETICAL_NO_ACTION"
                and simulation.get("external_effects_executed") is False
                and bool(simulation.get("candidate_futures"))
                and all(
                    future.get("required_verification")
                    for future in simulation.get("candidate_futures", [])
                )
            )
        else:
            passed = passed and response.get("simulation") is None
        if case["id"] == "simulate_deadline":
            passed = passed and response.get("hypothetical_deadline") == (
                "2026-08-28T19:00:00+00:00"
            )
        return 1.0 if passed else 0.0
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return 0.0
