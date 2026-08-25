"""Independent, evidence-based objective verification."""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from datetime import datetime
from typing import Protocol

from objective_recovery.domain.models import (
    EvidenceKind,
    InvariantObservation,
    ObjectiveInvariant,
    VerificationCheck,
    VerificationResult,
)


class ObjectiveVerifier(Protocol):
    def verify(
        self,
        *,
        objective_id: str,
        invariants: Iterable[ObjectiveInvariant],
        observations: Mapping[str, InvariantObservation],
        now: datetime,
    ) -> VerificationResult: ...


class DeterministicObjectiveVerifier:
    def verify(
        self,
        *,
        objective_id: str,
        invariants: Iterable[ObjectiveInvariant],
        observations: Mapping[str, InvariantObservation],
        now: datetime,
    ) -> VerificationResult:
        checks = tuple(
            self._check(invariant, observations.get(invariant.invariant_id), now)
            for invariant in sorted(invariants, key=lambda item: item.invariant_id)
        )
        return VerificationResult(objective_id=objective_id, observed_at=now, checks=checks)

    @staticmethod
    def _check(
        invariant: ObjectiveInvariant,
        observation: InvariantObservation | None,
        now: datetime,
    ) -> VerificationCheck:
        if observation is None:
            return VerificationCheck(
                invariant.invariant_id,
                False,
                "required evidence is missing",
                EvidenceKind.MISSING,
                None,
            )
        if observation.evidence_kind is not EvidenceKind.EXTERNAL:
            return VerificationCheck(
                invariant.invariant_id,
                False,
                "evidence is not an independent external read",
                observation.evidence_kind,
                observation.source_reference,
            )
        age_seconds = (now - observation.observed_at).total_seconds()
        if age_seconds < 0 or age_seconds > invariant.max_evidence_age_seconds:
            return VerificationCheck(
                invariant.invariant_id,
                False,
                "external evidence is stale or future-dated",
                observation.evidence_kind,
                observation.source_reference,
            )
        if not observation.passed:
            return VerificationCheck(
                invariant.invariant_id,
                False,
                "external state violates the invariant",
                observation.evidence_kind,
                observation.source_reference,
            )
        return VerificationCheck(
            invariant.invariant_id,
            True,
            "fresh external evidence satisfies the invariant",
            observation.evidence_kind,
            observation.source_reference,
        )
