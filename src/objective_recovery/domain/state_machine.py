"""Legal incident lifecycle transitions with verifier-only resolution."""

from __future__ import annotations

from dataclasses import dataclass, field

from objective_recovery.domain.errors import (
    IllegalStateTransitionError,
    ResolutionRequiresVerificationError,
)
from objective_recovery.domain.models import IncidentStatus, VerificationResult

_LEGAL_TRANSITIONS: dict[IncidentStatus, frozenset[IncidentStatus]] = {
    IncidentStatus.DETECTED: frozenset({IncidentStatus.INTERPRETING}),
    IncidentStatus.INTERPRETING: frozenset({IncidentStatus.IMPACT_MAPPED}),
    IncidentStatus.IMPACT_MAPPED: frozenset({IncidentStatus.PLANNING}),
    IncidentStatus.PLANNING: frozenset({IncidentStatus.VALIDATING}),
    IncidentStatus.VALIDATING: frozenset(
        {IncidentStatus.PLAN_SELECTED, IncidentStatus.EXECUTING, IncidentStatus.REPLANNING}
    ),
    IncidentStatus.PLAN_SELECTED: frozenset({IncidentStatus.EXECUTING}),
    IncidentStatus.EXECUTING: frozenset({IncidentStatus.VERIFYING, IncidentStatus.PARTIAL_FAILURE}),
    IncidentStatus.PARTIAL_FAILURE: frozenset(
        {IncidentStatus.COMPENSATING, IncidentStatus.REPLANNING}
    ),
    IncidentStatus.COMPENSATING: frozenset({IncidentStatus.REPLANNING}),
    IncidentStatus.VERIFYING: frozenset({IncidentStatus.VERIFICATION_FAILED}),
    IncidentStatus.VERIFICATION_FAILED: frozenset({IncidentStatus.REPLANNING}),
    IncidentStatus.REPLANNING: frozenset({IncidentStatus.VALIDATING}),
    IncidentStatus.RESOLVED: frozenset(),
}


@dataclass(slots=True)
class Incident:
    incident_id: str
    objective_id: str
    status: IncidentStatus = IncidentStatus.DETECTED
    plan_revision: int = 0
    history: list[IncidentStatus] = field(default_factory=lambda: [IncidentStatus.DETECTED])

    def transition_to(self, target: IncidentStatus) -> None:
        if target is IncidentStatus.RESOLVED:
            raise ResolutionRequiresVerificationError(
                "RESOLVED is reachable only through apply_verification"
            )
        if target not in _LEGAL_TRANSITIONS[self.status]:
            raise IllegalStateTransitionError(f"{self.status} -> {target}")
        self._set_status(target)

    def apply_verification(self, result: VerificationResult) -> None:
        if self.status is not IncidentStatus.VERIFYING:
            raise IllegalStateTransitionError(f"verification cannot be applied while {self.status}")
        if result.objective_id != self.objective_id:
            raise IllegalStateTransitionError("verification objective does not match incident")
        if result.passed:
            self._set_status(IncidentStatus.RESOLVED)
        else:
            self._set_status(IncidentStatus.VERIFICATION_FAILED)

    def _set_status(self, target: IncidentStatus) -> None:
        self.status = target
        if target is IncidentStatus.REPLANNING:
            self.plan_revision += 1
        self.history.append(target)
