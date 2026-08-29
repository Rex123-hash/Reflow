"""Deterministic formal grader for the P2I operational regression trace."""

import json
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
        intent = response.get("intent")
        agents = [item["agent_id"] for item in response["agents"]]
        direct_clarification = (
            case["id"] == "ambiguous"
            and response["conversation"]["mode"] == "CLARIFY"
            and intent is None
        )
        expected_intent = case["intent"]
        passed = (
            agents.count("conversation_understanding_agent") == 1
            and response["disposition"] == case["disposition"]
            and response["external_effects_executed"] is False
            and (
                (expected_intent is None and (intent is None or intent["intent_type"] is None))
                or (intent is not None and intent["intent_type"] == expected_intent)
            )
            and (
                "operator_intent_interpreter" not in agents
                if direct_clarification
                else agents.count("operator_intent_interpreter") == 1
            )
        )
        if expected_intent == "SIMULATE":
            simulation = response.get("simulation") or {}
            passed = passed and (
                agents.count("simulation_agent") == 1
                and response["provenance"] == "HYPOTHETICAL_NO_ACTION"
                and simulation.get("external_effects_executed") is False
                and bool(simulation.get("candidate_futures"))
                and all(
                    item.get("required_verification")
                    for item in simulation.get("candidate_futures", [])
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
