"""Claim, mutate, acknowledge, independently read back, and verify Calendar state."""

from __future__ import annotations

import time
from collections.abc import Callable
from dataclasses import replace
from datetime import UTC, datetime
from typing import Protocol, TypeVar

from objective_recovery.domain.models import (
    ActionReceipt,
    EvidenceKind,
    ReceiptStatus,
    RecoveryPlan,
)
from objective_recovery_agent.action_ledger import DurableActionLedger
from objective_recovery_agent.calendar_contract import (
    CalendarActionIntent,
    CalendarPolicyError,
    authorize_calendar_action,
    normalize_calendar_event,
    project_calendar_action,
    safe_observed_state,
    verification_differences,
)
from objective_recovery_agent.calendar_gateway import (
    CalendarAdapterError,
    CalendarErrorCategory,
    CalendarGateway,
)
from objective_recovery_agent.observability import OperationalEvent, emit_operational_event
from objective_recovery_agent.schemas import PlanningInput


class CalendarExecutionFailure(RuntimeError):
    def __init__(self, category: str, *, retryable: bool) -> None:
        super().__init__(category)
        self.category = category
        self.retryable = retryable


_T = TypeVar("_T")


class CalendarActionExecutor(Protocol):
    def execute(self, intent: CalendarActionIntent) -> ActionReceipt: ...

    def execute_selected_plan(
        self, *, incident_id: str, plan: RecoveryPlan, context: PlanningInput
    ) -> ActionReceipt: ...


class CalendarExecutionService:
    def __init__(
        self,
        *,
        calendar_id: str,
        ledger: DurableActionLedger,
        gateway: CalendarGateway,
        max_attempts: int = 3,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._calendar_id = calendar_id
        self._ledger = ledger
        self._gateway = gateway
        self._max_attempts = max_attempts
        self._sleep = sleep

    def execute_selected_plan(
        self, *, incident_id: str, plan: RecoveryPlan, context: PlanningInput
    ) -> ActionReceipt:
        try:
            intent = project_calendar_action(
                incident_id=incident_id,
                plan=plan,
                context=context,
                calendar_id=self._calendar_id,
            )
        except CalendarPolicyError as error:
            raise CalendarExecutionFailure("calendar_policy", retryable=False) from error
        return self.execute(intent)

    def _retry(self, operation: Callable[[], _T]) -> _T:
        for attempt in range(1, self._max_attempts + 1):
            try:
                return operation()
            except CalendarAdapterError as error:
                if not error.retryable or attempt == self._max_attempts:
                    raise
                self._sleep(float(2 ** (attempt - 1)))
        raise AssertionError("bounded retry loop exhausted unexpectedly")

    def _get_with_retry(self, intent: CalendarActionIntent) -> dict[str, object] | None:
        return self._retry(lambda: self._gateway.get_event(intent.calendar_id, intent.event_id))

    def execute(self, intent: CalendarActionIntent) -> ActionReceipt:
        authorize_calendar_action(intent, self._calendar_id)
        claim = self._ledger.claim(intent)
        receipt = claim.receipt
        emit_operational_event(
            OperationalEvent.ACTION_CLAIMED if claim.created else OperationalEvent.ACTION_RESUMED,
            incident_id=intent.incident_id,
            plan_id=intent.plan_id,
            action_id=intent.action.action_id,
            receipt_id=intent.receipt_id,
            idempotency_key=intent.action.idempotency_key,
        )
        if receipt.status is ReceiptStatus.VERIFIED:
            emit_operational_event(
                OperationalEvent.ACTION_DUPLICATE_SUPPRESSED,
                incident_id=intent.incident_id,
                action_id=intent.action.action_id,
                receipt_id=intent.receipt_id,
            )
            return receipt

        try:
            if receipt.status is ReceiptStatus.PENDING:
                existing = self._get_with_retry(intent)
                acknowledgement_at = datetime.now(UTC)
                etag: str | None = None
                if existing is None:
                    emit_operational_event(
                        OperationalEvent.CALENDAR_WRITE_STARTED,
                        incident_id=intent.incident_id,
                        action_id=intent.action.action_id,
                        receipt_id=intent.receipt_id,
                        external_event_id=intent.event_id,
                    )
                    try:
                        acknowledgement = self._retry(lambda: self._gateway.insert_event(intent))
                    except CalendarAdapterError as error:
                        if error.category is not CalendarErrorCategory.CONFLICT:
                            raise
                        recovered = self._get_with_retry(intent)
                        if recovered is None:
                            raise CalendarExecutionFailure(
                                "calendar_conflict_without_existing_event", retryable=True
                            ) from error
                        existing = recovered
                    else:
                        etag = acknowledgement.etag
                if existing is not None and existing.get("etag") is not None:
                    etag = str(existing["etag"])
                receipt = replace(
                    receipt,
                    status=ReceiptStatus.WRITE_ACKNOWLEDGED,
                    evidence_kind=EvidenceKind.EXTERNAL,
                    observed_at=acknowledgement_at,
                    external_reference=f"google_calendar:{intent.event_id}",
                    write_acknowledged_at=acknowledgement_at,
                    external_etag=etag,
                )
                self._ledger.record_receipt(receipt)
                emit_operational_event(
                    OperationalEvent.CALENDAR_WRITE_ACKNOWLEDGED,
                    incident_id=intent.incident_id,
                    action_id=intent.action.action_id,
                    receipt_id=intent.receipt_id,
                    external_event_id=intent.event_id,
                )

            emit_operational_event(
                OperationalEvent.CALENDAR_READBACK_STARTED,
                incident_id=intent.incident_id,
                action_id=intent.action.action_id,
                receipt_id=intent.receipt_id,
                external_event_id=intent.event_id,
            )
            observed_payload: dict[str, object] | None = None
            for attempt in range(1, self._max_attempts + 1):
                observed_payload = self._get_with_retry(intent)
                if observed_payload is not None:
                    break
                if attempt < self._max_attempts:
                    self._sleep(float(2 ** (attempt - 1)))
            if observed_payload is None:
                raise CalendarExecutionFailure("calendar_readback_not_found", retryable=True)
            read_back_at = datetime.now(UTC)
            observed = normalize_calendar_event(
                calendar_id=intent.calendar_id, payload=observed_payload
            )
            differences = verification_differences(intent, observed)
            final_status = (
                ReceiptStatus.VERIFICATION_FAILED if differences else ReceiptStatus.VERIFIED
            )
            receipt = replace(
                receipt,
                status=final_status,
                evidence_kind=EvidenceKind.EXTERNAL,
                observed_at=read_back_at,
                read_back_at=read_back_at,
                observed_state=safe_observed_state(observed),
                verification_differences=differences,
            )
            self._ledger.record_receipt(receipt)
            emit_operational_event(
                OperationalEvent.ACTION_RECEIPT_VERIFICATION_FAILED
                if differences
                else OperationalEvent.ACTION_RECEIPT_VERIFIED,
                incident_id=intent.incident_id,
                action_id=intent.action.action_id,
                receipt_id=intent.receipt_id,
                external_event_id=intent.event_id,
                difference_count=len(differences),
            )
            return receipt
        except CalendarExecutionFailure:
            raise
        except CalendarAdapterError as error:
            now = datetime.now(UTC)
            if not error.retryable:
                failed = replace(
                    receipt,
                    status=ReceiptStatus.FAILED,
                    observed_at=now,
                    failure_category=error.category.value,
                    retryable=False,
                )
                self._ledger.record_receipt(failed)
            emit_operational_event(
                OperationalEvent.CALENDAR_WRITE_FAILED,
                incident_id=intent.incident_id,
                action_id=intent.action.action_id,
                receipt_id=intent.receipt_id,
                error_category=error.category.value,
            )
            raise CalendarExecutionFailure(
                error.category.value, retryable=error.retryable
            ) from error
