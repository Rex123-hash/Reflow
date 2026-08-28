"""Local agents-cli metric applied to genuinely generated ADK intent traces."""

import json
from typing import Any


def _text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        if "response" in value:
            return _text(value["response"])
        return str(value.get("text") or (value.get("parts") or [{}])[0].get("text", ""))
    return ""


def evaluate(instance: dict[str, Any]) -> float:
    try:
        response = json.loads(_text(instance.get("response")))
        case = json.loads(_text(instance.get("reference")))
        intent = response["intent"]
        operations = intent["requested_operations"]
        passed = (
            intent["intent_type"] == case["intent"]
            and intent["disposition"] == case["disposition"]
            and sorted(op["operation"] for op in operations) == sorted(case["operations"])
            and (
                not case.get("target") or intent["target"]["resource_identifier"] == case["target"]
            )
            and (not case.get("value") or operations[0]["value"] == case["value"])
            and response["external_effects_executed"] is False
            and response["agents"][0]["agent_id"] == "operator_intent_interpreter"
            and response["agents"][0]["model"] == "gemini-3.7-flash"
        )
        return float(passed)
    except (KeyError, IndexError, TypeError, ValueError):
        return 0.0
