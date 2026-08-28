"""Deterministic Operator authorization, durable lifecycle, dispatch, and read-back."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from threading import BoundedSemaphore, RLock
from typing import Any, ClassVar, Literal, Protocol, cast

from google.cloud import firestore

from objective_recovery_agent.observability import emit_operational_event
from objective_recovery_agent.operator_schemas import (
    Authority,
    OperatorActionView,
    OperatorCapability,
    OperatorInspection,
    OperatorTarget,
    RequestedOperation,
    ResourceType,
)
from objective_recovery_agent.slack_operator_policy import slack_message_denial

AuthorizationResult = Literal["AUTO_EXECUTABLE", "APPROVAL_REQUIRED", "DENIED"]


class OperatorAdapterError(RuntimeError):
    """Safe adapter failure whose category can be returned without leaking a response body."""

    def __init__(self, category: str, diagnostics: dict[str, str] | None = None) -> None:
        super().__init__(category)
        self.category = category
        self.diagnostics = dict(diagnostics or {})


@dataclass(frozen=True, slots=True)
class AdapterExecution:
    expected_state: dict[str, str | None]
    acknowledgement: dict[str, str]


class OperatorActionAdapter(Protocol):
    authority: Authority
    resource_type: ResourceType
    operations: frozenset[str]
    resource_identifiers: tuple[str, ...]

    def permits_target(self, target: OperatorTarget) -> bool: ...

    def inspect(self, target: OperatorTarget) -> dict[str, str | None]: ...

    def propose(
        self,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
    ) -> dict[str, str]: ...

    def execute(
        self,
        action_id: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
        proposal: dict[str, str],
    ) -> AdapterExecution: ...

    def read_back(
        self,
        target: OperatorTarget,
        acknowledgement: dict[str, str],
    ) -> dict[str, str | None]: ...

    def verify(
        self,
        expected: dict[str, str | None],
        observed: dict[str, str | None],
    ) -> tuple[bool, dict[str, str]]: ...


class CapabilityRegistry:
    """Small server-owned registry; the model sees values, never adapter objects."""

    def __init__(self, adapters: tuple[OperatorActionAdapter, ...] = ()) -> None:
        self._adapters = {adapter.authority: adapter for adapter in adapters}

    def capabilities(self) -> tuple[OperatorCapability, ...]:
        values = [
            OperatorCapability(
                authority=adapter.authority,
                resource_type=cast(Any, adapter.resource_type),
                operations=cast(Any, tuple(sorted(adapter.operations))),
                resource_identifiers=adapter.resource_identifiers,
            )
            for adapter in self._adapters.values()
        ]
        # Agent 6 must recognize this request so hard policy can deny it downstream.
        values.append(
            OperatorCapability(
                authority="REFLOW",
                resource_type="OBJECTIVE",
                operations=("MOVE_PROTECTED_DEADLINE",),
                resource_identifiers=("protected-objective-deadline",),
            )
        )
        return tuple(sorted(values, key=lambda item: item.authority))

    def adapter(self, authority: Authority) -> OperatorActionAdapter | None:
        return self._adapters.get(authority)

    def inspect(self, target: OperatorTarget) -> OperatorInspection:
        adapter = self.adapter(target.authority)
        if adapter is None or not adapter.permits_target(target):
            raise OperatorAdapterError("target_not_permitted")
        observed = adapter.inspect(target)
        return OperatorInspection(
            authority=target.authority,
            resource_type=target.resource_type,
            resource_identifier=target.resource_identifier,
            observed_state=observed,
            observed_at=datetime.now(UTC).isoformat(),
        )


class ActionAuthorizationPolicy:
    """All authorization decisions are deterministic code, never model output."""

    _JIRA_AUTO: ClassVar[set[str]] = {
        "JIRA_TRANSITION",
        "JIRA_SET_PRIORITY",
        "JIRA_SET_DUE_DATE",
        "JIRA_ADD_COMMENT",
    }

    def decide(
        self,
        role: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        registry: CapabilityRegistry,
    ) -> tuple[AuthorizationResult, str]:
        if role != "OPERATOR":
            return "DENIED", "viewer_cannot_act"
        if not operations or len({item.operation for item in operations}) != len(operations):
            return "DENIED", "duplicate_or_empty_operations"
        if target.authority == "REFLOW" or any(
            item.operation == "MOVE_PROTECTED_DEADLINE" for item in operations
        ):
            return "DENIED", "protected_objective_deadline"
        adapter = registry.adapter(target.authority)
        if adapter is None or not adapter.permits_target(target):
            return "DENIED", "target_not_permitted"
        if any(item.operation not in adapter.operations for item in operations):
            return "DENIED", "unsupported_capability"
        if target.authority == "SLACK":
            if len(operations) != 1 or operations[0].operation != "SLACK_POST_MESSAGE":
                return "DENIED", "unsupported_slack_mutation"
            reason = slack_message_denial(operations[0].value)
            return (
                ("DENIED", reason)
                if reason
                else ("AUTO_EXECUTABLE", "bounded_configured_slack_message")
            )
        if any(item.operation == "JIRA_ASSIGN" for item in operations):
            return "APPROVAL_REQUIRED", "cross_person_assignment"
        if target.authority == "JIRA":
            if any(item.operation not in self._JIRA_AUTO for item in operations):
                return "DENIED", "unsupported_jira_operation"
            return "AUTO_EXECUTABLE", "bounded_demo_issue_change"
        if target.authority == "GOOGLE_CALENDAR":
            shifts = [item for item in operations if item.operation == "CALENDAR_RESCHEDULE"]
            for item in shifts:
                value = item.value or ""
                if value.lstrip("+-").isdigit():
                    minutes = abs(int(value))
                    if minutes > 480 or minutes == 0:
                        return "DENIED", "calendar_shift_outside_safe_bounds"
                    if minutes > 120:
                        return "APPROVAL_REQUIRED", "large_calendar_shift"
                else:
                    # Absolute-time changes need confirmation because their delta is
                    # resolved only against authoritative adapter state.
                    try:
                        if datetime.fromisoformat(value).tzinfo is None:
                            raise ValueError
                    except ValueError:
                        return "DENIED", "invalid_calendar_time"
                    return "APPROVAL_REQUIRED", "absolute_calendar_reschedule"
            return "AUTO_EXECUTABLE", "bounded_operator_demo_event_change"
        return "DENIED", "unsupported_authority"


class OperatorActionStore(Protocol):
    def claim(
        self, action: OperatorActionView, fingerprint: str
    ) -> tuple[bool, OperatorActionView]: ...

    def get(self, action_id: str) -> OperatorActionView | None: ...

    def advance(
        self,
        action: OperatorActionView,
        allowed_from: frozenset[str],
    ) -> OperatorActionView: ...


class InMemoryOperatorActionStore:
    def __init__(self) -> None:
        self._lock = RLock()
        self.actions: dict[str, OperatorActionView] = {}
        self.fingerprints: dict[str, str] = {}

    def claim(
        self, action: OperatorActionView, fingerprint: str
    ) -> tuple[bool, OperatorActionView]:
        with self._lock:
            existing = self.actions.get(action.operator_action_id)
            if existing is not None:
                if self.fingerprints[action.operator_action_id] != fingerprint:
                    raise OperatorAdapterError("idempotency_conflict")
                return False, existing
            self.actions[action.operator_action_id] = action
            self.fingerprints[action.operator_action_id] = fingerprint
            return True, action

    def get(self, action_id: str) -> OperatorActionView | None:
        return self.actions.get(action_id)

    def advance(
        self, action: OperatorActionView, allowed_from: frozenset[str]
    ) -> OperatorActionView:
        with self._lock:
            existing = self.actions.get(action.operator_action_id)
            if existing is None or existing.lifecycle not in allowed_from:
                raise OperatorAdapterError("invalid_action_transition")
            self.actions[action.operator_action_id] = action
            return action


class FirestoreOperatorActionStore:
    COLLECTION = "operator_actions"

    def __init__(self, project_id: str) -> None:
        self._client = firestore.Client(project=project_id)

    @staticmethod
    def _decode(value: dict[str, Any]) -> OperatorActionView:
        data = dict(value)
        data.pop("intent_fingerprint", None)
        return OperatorActionView.model_validate(data)

    def claim(
        self, action: OperatorActionView, fingerprint: str
    ) -> tuple[bool, OperatorActionView]:
        ref = self._client.collection(self.COLLECTION).document(action.operator_action_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def create(transaction: Any) -> tuple[bool, OperatorActionView]:
            snapshot = ref.get(transaction=transaction)
            if snapshot.exists:
                value = snapshot.to_dict() or {}
                if value.get("intent_fingerprint") != fingerprint:
                    raise OperatorAdapterError("idempotency_conflict")
                return False, self._decode(value)
            transaction.create(
                ref,
                {**action.model_dump(mode="json"), "intent_fingerprint": fingerprint},
            )
            return True, action

        return cast(tuple[bool, OperatorActionView], create(transaction))

    def get(self, action_id: str) -> OperatorActionView | None:
        snapshot = self._client.collection(self.COLLECTION).document(action_id).get()
        return self._decode(snapshot.to_dict() or {}) if snapshot.exists else None

    def advance(
        self, action: OperatorActionView, allowed_from: frozenset[str]
    ) -> OperatorActionView:
        ref = self._client.collection(self.COLLECTION).document(action.operator_action_id)
        transaction = self._client.transaction()

        @firestore.transactional
        def update(transaction: Any) -> OperatorActionView:
            snapshot = ref.get(transaction=transaction)
            if not snapshot.exists:
                raise OperatorAdapterError("missing_action")
            value = snapshot.to_dict() or {}
            if value.get("lifecycle") not in allowed_from:
                raise OperatorAdapterError("invalid_action_transition")
            transaction.update(ref, action.model_dump(mode="json"))
            return action

        return cast(OperatorActionView, update(transaction))


def _fingerprint(
    target: OperatorTarget, operations: tuple[RequestedOperation, ...], subject: str
) -> str:
    material = {
        "subject": subject,
        "target": target.model_dump(mode="json"),
        "operations": [item.model_dump(mode="json") for item in operations],
    }
    return hashlib.sha256(
        json.dumps(material, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


class OperatorActionCoordinator:
    def __init__(
        self,
        registry: CapabilityRegistry,
        store: OperatorActionStore,
        policy: ActionAuthorizationPolicy | None = None,
    ) -> None:
        self.registry = registry
        self._store = store
        self._policy = policy or ActionAuthorizationPolicy()
        self._execution_slots = BoundedSemaphore(2)

    def replay(self, subject: str, key: str, fingerprint: str) -> OperatorActionView | None:
        action = self._store.get(hashlib.sha256(f"{subject}|{key}".encode()).hexdigest())
        if action is not None and action.request_fingerprint != fingerprint:
            raise OperatorAdapterError("idempotency_conflict")
        return action

    def request(
        self,
        *,
        request_id: str,
        idempotency_key: str,
        subject_hash: str,
        role: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        request_fingerprint: str | None = None,
    ) -> OperatorActionView:
        action_id = hashlib.sha256(f"{subject_hash}|{idempotency_key}".encode()).hexdigest()
        decision, reason = self._policy.decide(role, target, operations, self.registry)
        now = datetime.now(UTC).isoformat()
        proposed = OperatorActionView(
            operator_action_id=action_id,
            request_id=request_id,
            authenticated_subject_hash=subject_hash,
            authority=target.authority,
            resource_type=target.resource_type,
            resource_identifier=target.resource_identifier,
            operations=operations,
            authorization_result=decision,
            lifecycle="REQUESTED",
            adapter_proof={"policy_reason": reason},
            created_at=now,
            updated_at=now,
            request_fingerprint=request_fingerprint,
        )
        created, action = self._store.claim(
            proposed, request_fingerprint or _fingerprint(target, operations, subject_hash)
        )
        if not created:
            return action
        emit_operational_event(
            "OPERATOR_ACTION_REQUESTED",
            request_id=request_id,
            action_id=action_id,
            subject_hash=subject_hash,
            authority=target.authority,
            operation=",".join(item.operation for item in operations),
            target=target.resource_identifier,
            authorization=decision,
        )
        if decision == "DENIED":
            return self._replace(action, "DENIED", frozenset({"REQUESTED"}))
        # Resolve the identifier before offering approval or executing.
        try:
            inspection = self.registry.inspect(target)
            adapter = self.registry.adapter(target.authority)
            if adapter is None:
                raise OperatorAdapterError("adapter_unavailable")
            proposal = adapter.propose(target, operations, inspection.observed_state)
        except OperatorAdapterError as error:
            return self._fail(
                action,
                frozenset({"REQUESTED"}),
                error.category,
                diagnostics=error.diagnostics,
            )
        proof = {
            **action.adapter_proof,
            **proposal,
            "baseline": json.dumps(inspection.observed_state, sort_keys=True),
        }
        if decision == "APPROVAL_REQUIRED":
            return self._replace(
                action,
                "APPROVAL_REQUIRED",
                frozenset({"REQUESTED"}),
                adapter_proof=proof,
            )
        action = self._replace(
            action,
            "AUTHORIZED",
            frozenset({"REQUESTED"}),
            adapter_proof=proof,
        )
        return self._execute(action)

    def approve(self, action_id: str, subject_hash: str, role: str) -> OperatorActionView:
        action = self._store.get(action_id)
        if action is None:
            raise OperatorAdapterError("missing_action")
        if role != "OPERATOR" or action.authenticated_subject_hash != subject_hash:
            raise OperatorAdapterError("approval_not_authorized")
        if action.lifecycle in {"VERIFIED", "VERIFICATION_FAILED", "FAILED", "DENIED"}:
            return action
        if action.lifecycle != "APPROVAL_REQUIRED":
            return action  # A concurrent approval may already be executing; never execute twice.
        target = OperatorTarget(
            authority=action.authority,
            resource_type=action.resource_type,
            resource_identifier=action.resource_identifier,
        )
        decision, _ = self._policy.decide(role, target, action.operations, self.registry)
        if decision == "DENIED" or datetime.now(UTC) - datetime.fromisoformat(
            action.created_at
        ) > timedelta(minutes=15):
            return self._fail(
                action, frozenset({"APPROVAL_REQUIRED"}), "approval_expired_or_revoked"
            )
        action = self._replace(action, "APPROVED", frozenset({"APPROVAL_REQUIRED"}))
        return self._execute(action)

    def _replace(
        self,
        action: OperatorActionView,
        lifecycle: str,
        allowed_from: frozenset[str],
        **changes: Any,
    ) -> OperatorActionView:
        now = datetime.now(UTC)
        changes["adapter_proof"] = {
            **changes.get("adapter_proof", action.adapter_proof),
            f"{lifecycle.lower()}_at": now.isoformat(),
        }
        replacement = OperatorActionView.model_validate(
            {
                **action.model_dump(),
                "lifecycle": lifecycle,
                "updated_at": now.isoformat(),
                **changes,
            }
        )
        result = self._store.advance(replacement, allowed_from)
        emit_operational_event(
            "OPERATOR_ACTION_STATE",
            request_id=result.request_id,
            action_id=result.operator_action_id,
            subject_hash=result.authenticated_subject_hash,
            authority=result.authority,
            operation=",".join(item.operation for item in result.operations),
            target=result.resource_identifier,
            authorization=result.authorization_result,
            lifecycle=result.lifecycle,
            verification_result=result.verification_result,
            elapsed_ms=int(
                (now - datetime.fromisoformat(result.created_at)).total_seconds() * 1000
            ),
        )
        return result

    def _fail(
        self,
        action: OperatorActionView,
        allowed_from: frozenset[str],
        category: str,
        *,
        diagnostics: dict[str, str] | None = None,
    ) -> OperatorActionView:
        emit_operational_event(
            "OPERATOR_ACTION_FAILED",
            request_id=action.request_id,
            action_id=action.operator_action_id,
            authority=action.authority,
            operation=",".join(item.operation for item in action.operations),
            target=action.resource_identifier,
            execution_result="FAILED",
            error_category=category,
        )
        return self._replace(
            action,
            "FAILED",
            allowed_from,
            error_category=category,
            adapter_proof={**action.adapter_proof, **(diagnostics or {})},
        )

    def _execute(self, action: OperatorActionView) -> OperatorActionView:
        # This synchronous bound survives cancellation of an HTTP waiter/to_thread.
        if not self._execution_slots.acquire(blocking=False):
            return self._fail(action, frozenset({"AUTHORIZED", "APPROVED"}), "execution_busy")
        try:
            return self._execute_owned(action)
        finally:
            self._execution_slots.release()

    def _execute_owned(self, action: OperatorActionView) -> OperatorActionView:
        allowed = frozenset({"AUTHORIZED", "APPROVED"})
        adapter = self.registry.adapter(action.authority)
        if adapter is None:
            return self._fail(action, allowed, "adapter_unavailable")
        target = OperatorTarget(
            authority=action.authority,
            resource_type=action.resource_type,
            resource_identifier=action.resource_identifier,
        )
        action = self._replace(action, "EXECUTING", allowed)
        try:
            current = adapter.inspect(target)
            if json.dumps(current, sort_keys=True) != action.adapter_proof.get("baseline"):
                raise OperatorAdapterError("proposal_stale_request_again")
            # Re-resolve before the first write; never silently approve a new identity/transition.
            proposal = adapter.propose(target, action.operations, current)
            if any(action.adapter_proof.get(k) != v for k, v in proposal.items()):
                raise OperatorAdapterError("proposal_resolution_changed")
            for index, operation in enumerate(action.operations):
                # Persist uncertainty BEFORE each write. A process crash or lost ACK must
                # never imply no effect, and EXECUTING records are never re-executed.
                action = self._replace(
                    action,
                    "EXECUTING",
                    frozenset({"EXECUTING", "READ_BACK"}),
                    external_effects_possible=True,
                    adapter_proof={**action.adapter_proof, "attempted_operations": str(index + 1)},
                )
                execution = adapter.execute(
                    action.operator_action_id, target, (operation,), current, action.adapter_proof
                )
                action = self._replace(
                    action,
                    "EXECUTED",
                    frozenset({"EXECUTING"}),
                    expected_state={**action.expected_state, **execution.expected_state},
                    execution_acknowledgement={
                        **action.execution_acknowledgement,
                        **execution.acknowledgement,
                    },
                )
                observed = adapter.read_back(target, action.execution_acknowledgement)
                action = self._replace(
                    action, "READ_BACK", frozenset({"EXECUTED"}), observed_state=observed
                )
                passed, proof = adapter.verify(action.expected_state, observed)
                if not passed:
                    break
                current = observed
            final = "VERIFIED" if passed else "VERIFICATION_FAILED"
            result = self._replace(
                action,
                final,
                frozenset({"READ_BACK"}),
                verification_result="PASSED" if passed else "FAILED",
                adapter_proof={**action.adapter_proof, **proof},
            )
            emit_operational_event(
                "OPERATOR_ACTION_COMPLETED",
                request_id=result.request_id,
                action_id=result.operator_action_id,
                subject_hash=result.authenticated_subject_hash,
                authority=result.authority,
                operation=",".join(item.operation for item in result.operations),
                target=result.resource_identifier,
                authorization=result.authorization_result,
                execution_result="ACKNOWLEDGED",
                read_back_result="SUCCEEDED",
                verification_result=result.verification_result,
            )
            return result
        except OperatorAdapterError as error:
            return self._fail(
                action,
                frozenset({"EXECUTING", "EXECUTED", "READ_BACK"}),
                error.category,
                diagnostics=error.diagnostics,
            )
        except Exception:
            # Adapter/transport internals are not safe response text. Preserve the last
            # durable acknowledgement and explicitly possible effects on unexpected failures.
            return self._fail(
                action,
                frozenset({"EXECUTING", "EXECUTED", "READ_BACK"}),
                "unexpected_adapter_failure",
            )
