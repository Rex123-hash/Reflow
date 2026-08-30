"""Server-owned authority boundary for the public demonstration workspace."""

from __future__ import annotations

from typing import Final, Literal

CANONICAL_DEMO_INCIDENT_ID: Final = "incident-0fc3af5b0bd1ad847aea"
DEMO_OPERATOR_ROLE: Final = "DEMO"
OperatorBackendRole = Literal["VIEWER", "OPERATOR", "DEMO"]


def is_canonical_demo_incident(incident_id: str) -> bool:
    """Return whether an untrusted incident selector stays inside the demo record."""

    return incident_id == CANONICAL_DEMO_INCIDENT_ID


__all__ = [
    "CANONICAL_DEMO_INCIDENT_ID",
    "DEMO_OPERATOR_ROLE",
    "OperatorBackendRole",
    "is_canonical_demo_incident",
]
