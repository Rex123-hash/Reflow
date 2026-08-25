from datetime import UTC, datetime, timedelta

import pytest

from objective_recovery.domain.errors import (
    IllegalStateTransitionError,
    ResolutionRequiresVerificationError,
)
from objective_recovery.domain.models import (
    EvidenceKind,
    IncidentStatus,
    InvariantObservation,
    ObjectiveInvariant,
    VerificationResult,
)
from objective_recovery.domain.state_machine import Incident
from objective_recovery.domain.verification import DeterministicObjectiveVerifier

NOW = datetime(2026, 8, 25, 12, tzinfo=UTC)
INVARIANT = ObjectiveInvariant("ci-green", "Required CI is green", 60)


def observation(
    *,
    passed: bool = True,
    kind: EvidenceKind = EvidenceKind.EXTERNAL,
    observed_at: datetime = NOW,
    invariant_id: str = "ci-green",
) -> InvariantObservation:
    return InvariantObservation(
        invariant_id=invariant_id,
        passed=passed,
        evidence_kind=kind,
        observed_at=observed_at,
        source_reference="github:check-run:42",
    )


def verify(obs: InvariantObservation | None) -> VerificationResult:
    observations = {} if obs is None else {obs.invariant_id: obs}
    return DeterministicObjectiveVerifier().verify(
        objective_id="release-v2",
        invariants=[INVARIANT],
        observations=observations,
        now=NOW,
    )


@pytest.mark.parametrize(
    ("obs", "reason", "kind"),
    [
        (None, "required evidence is missing", EvidenceKind.MISSING),
        (
            observation(kind=EvidenceKind.EMULATED),
            "evidence is not an independent external read",
            EvidenceKind.EMULATED,
        ),
        (
            observation(kind=EvidenceKind.MODEL_ASSERTION),
            "evidence is not an independent external read",
            EvidenceKind.MODEL_ASSERTION,
        ),
        (
            observation(observed_at=NOW - timedelta(seconds=61)),
            "external evidence is stale or future-dated",
            EvidenceKind.EXTERNAL,
        ),
        (
            observation(observed_at=NOW + timedelta(seconds=1)),
            "external evidence is stale or future-dated",
            EvidenceKind.EXTERNAL,
        ),
        (
            observation(passed=False),
            "external state violates the invariant",
            EvidenceKind.EXTERNAL,
        ),
    ],
)
def test_verifier_rejects_missing_untrusted_stale_or_failed_evidence(
    obs: InvariantObservation | None, reason: str, kind: EvidenceKind
) -> None:
    result = verify(obs)
    assert not result.passed
    assert result.checks[0].reason == reason
    assert result.checks[0].evidence_kind is kind


def test_verifier_accepts_only_fresh_external_pass_and_orders_checks() -> None:
    second = ObjectiveInvariant("calendar-staffed", "Review staffed", 60)
    observations = {
        "ci-green": observation(),
        "calendar-staffed": observation(invariant_id="calendar-staffed"),
    }
    result = DeterministicObjectiveVerifier().verify(
        objective_id="release-v2",
        invariants=[INVARIANT, second],
        observations=observations,
        now=NOW,
    )
    assert result.passed
    assert [check.invariant_id for check in result.checks] == [
        "calendar-staffed",
        "ci-green",
    ]
    assert all(check.source_reference for check in result.checks)


def incident_at_verifying() -> Incident:
    incident = Incident("incident-1", "release-v2")
    for state in (
        IncidentStatus.INTERPRETING,
        IncidentStatus.IMPACT_MAPPED,
        IncidentStatus.PLANNING,
        IncidentStatus.VALIDATING,
        IncidentStatus.EXECUTING,
        IncidentStatus.VERIFYING,
    ):
        incident.transition_to(state)
    return incident


def test_verification_failure_reopens_incident_for_replanning() -> None:
    incident = incident_at_verifying()
    incident.apply_verification(verify(observation(passed=False)))
    incident.transition_to(IncidentStatus.REPLANNING)
    assert incident.status is IncidentStatus.REPLANNING
    assert incident.plan_revision == 1
    incident.transition_to(IncidentStatus.VALIDATING)
    assert incident.history[-3:] == [
        IncidentStatus.VERIFICATION_FAILED,
        IncidentStatus.REPLANNING,
        IncidentStatus.VALIDATING,
    ]


def test_objective_resolves_only_through_matching_passing_verifier() -> None:
    incident = incident_at_verifying()
    with pytest.raises(ResolutionRequiresVerificationError):
        incident.transition_to(IncidentStatus.RESOLVED)
    incident.apply_verification(verify(observation()))
    assert incident.status is IncidentStatus.RESOLVED


def test_illegal_transitions_and_verification_context_are_rejected() -> None:
    incident = Incident("incident-1", "release-v2")
    with pytest.raises(IllegalStateTransitionError):
        incident.transition_to(IncidentStatus.EXECUTING)
    with pytest.raises(IllegalStateTransitionError):
        incident.apply_verification(verify(observation()))

    verifying = incident_at_verifying()
    wrong_objective = VerificationResult("another-objective", NOW, verify(observation()).checks)
    with pytest.raises(IllegalStateTransitionError):
        verifying.apply_verification(wrong_objective)


def test_empty_verification_result_never_passes() -> None:
    assert not VerificationResult("release-v2", NOW, ()).passed


def test_partial_failure_and_compensation_paths_are_legal() -> None:
    incident = Incident("incident-1", "release-v2")
    for state in (
        IncidentStatus.INTERPRETING,
        IncidentStatus.IMPACT_MAPPED,
        IncidentStatus.PLANNING,
        IncidentStatus.VALIDATING,
        IncidentStatus.EXECUTING,
        IncidentStatus.PARTIAL_FAILURE,
        IncidentStatus.COMPENSATING,
        IncidentStatus.REPLANNING,
    ):
        incident.transition_to(state)
    assert incident.plan_revision == 1


def test_partial_failure_can_replan_without_compensation() -> None:
    incident = Incident("incident-1", "release-v2")
    for state in (
        IncidentStatus.INTERPRETING,
        IncidentStatus.IMPACT_MAPPED,
        IncidentStatus.PLANNING,
        IncidentStatus.VALIDATING,
        IncidentStatus.EXECUTING,
        IncidentStatus.PARTIAL_FAILURE,
        IncidentStatus.REPLANNING,
    ):
        incident.transition_to(state)
    assert incident.status is IncidentStatus.REPLANNING


def test_validation_can_replan_when_no_candidate_is_valid() -> None:
    incident = Incident("incident-1", "release-v2")
    for state in (
        IncidentStatus.INTERPRETING,
        IncidentStatus.IMPACT_MAPPED,
        IncidentStatus.PLANNING,
        IncidentStatus.VALIDATING,
        IncidentStatus.REPLANNING,
    ):
        incident.transition_to(state)
    assert incident.plan_revision == 1
