from __future__ import annotations

from scripts.evaluate_operator import evaluation_trace


def test_evaluation_trace_retains_safe_failure_without_fabricating_response() -> None:
    records = [
        {
            "case": {"id": "simulate_ci", "message": "What if CI passed?"},
            "passed": False,
            "error": "OperatorReasoningError",
            "failure": {
                "case_id": "simulate_ci",
                "agent_name": "simulation_agent",
                "request_correlation_id": "request-123",
                "elapsed_ms": 25053,
                "timeout_category": "timeout",
                "completed": False,
            },
        }
    ]
    trace = evaluation_trace(records)
    assert len(trace["evalCases"]) == 1
    failed = trace["evalCases"][0]
    assert failed["evalCaseId"] == "simulate_ci"
    assert failed["responses"] == []
    assert failed["failureMetadata"] == records[0]["failure"]
