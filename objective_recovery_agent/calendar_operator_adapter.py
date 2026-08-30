"""Human-directed Calendar adapter for bounded updates and event creation."""

from __future__ import annotations

import hashlib
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from objective_recovery_agent.calendar_gateway import (
    CalendarAdapterError,
    CalendarErrorCategory,
    GoogleCalendarGateway,
)
from objective_recovery_agent.calendar_operator_contract import (
    CALENDAR_CREATE_OPERATION,
    CALENDAR_CREATE_RESOURCE,
    CalendarEventCreation,
    calendar_event_id,
    canonical_reminders,
    reminder_payload,
)
from objective_recovery_agent.operator_actions import AdapterExecution, OperatorAdapterError
from objective_recovery_agent.operator_schemas import (
    Authority,
    OperatorTarget,
    RequestedOperation,
    ResourceType,
)


class OperatorCalendarGateway(GoogleCalendarGateway):
    """Additive Calendar operation surface; the frozen recovery gateway is unchanged."""

    def patch_event(
        self,
        calendar_id: str,
        event_id: str,
        payload: dict[str, object],
        etag: str | None,
    ) -> dict[str, Any]:
        if not etag:
            raise OperatorAdapterError("calendar_etag_required")
        headers = {"If-Match": etag}
        response = self._request(
            "PATCH",
            self._event_url(calendar_id, event_id),
            params={"sendUpdates": "none"},
            headers=headers,
            json=payload,
        )
        value = response.json()
        if not isinstance(value, dict) or value.get("id") != event_id:
            raise OperatorAdapterError("calendar_invalid_response")
        return value

    def create_operator_demo_event(
        self,
        calendar_id: str,
        event_id: str,
        start: str,
        end: str,
    ) -> dict[str, Any]:
        response = self._request(
            "POST",
            self._event_url(calendar_id),
            params={"sendUpdates": "none"},
            json={
                "id": event_id,
                "summary": "Reflow Operator Demo — Coordination",
                "description": (
                    "Dedicated safe resource for verified human-directed Operator actions."
                ),
                "start": {"dateTime": start},
                "end": {"dateTime": end},
                "status": "confirmed",
                "visibility": "private",
                "transparency": "opaque",
                "extendedProperties": {"private": {"reflow_resource": "operator_demo"}},
            },
        )
        value = response.json()
        if not isinstance(value, dict) or value.get("id") != event_id:
            raise OperatorAdapterError("calendar_invalid_response")
        return value

    def insert_operator_event(
        self,
        calendar_id: str,
        event_id: str,
        action_id: str,
        event: CalendarEventCreation,
    ) -> dict[str, Any]:
        payload: dict[str, object] = {
            "id": event_id,
            "summary": event.summary,
            "start": {"dateTime": event.start, "timeZone": event.timezone},
            "end": {"dateTime": event.end, "timeZone": event.timezone},
            "visibility": "private",
            "transparency": "opaque",
            "reminders": reminder_payload(event.reminders),
            "extendedProperties": {
                "private": {
                    "reflow_resource": "operator_created",
                    "reflow_action_id": action_id,
                }
            },
        }
        if event.description is not None:
            payload["description"] = event.description
        if event.location is not None:
            payload["location"] = event.location
        response = self._request(
            "POST",
            self._event_url(calendar_id),
            params={"sendUpdates": "none"},
            json=payload,
        )
        value = response.json()
        if not isinstance(value, dict) or value.get("id") != event_id:
            raise OperatorAdapterError("calendar_invalid_response")
        return value


class CalendarOperatorAdapter:
    authority: Authority = "GOOGLE_CALENDAR"
    resource_type: ResourceType = "EVENT"
    operations = frozenset(
        {
            "CALENDAR_RESCHEDULE",
            "CALENDAR_UPDATE_TITLE",
            "CALENDAR_UPDATE_DESCRIPTION",
            CALENDAR_CREATE_OPERATION,
        }
    )

    def __init__(
        self,
        *,
        calendar_id: str,
        demo_event_id: str | None,
        gateway: OperatorCalendarGateway,
        timezone: str = "Etc/UTC",
    ) -> None:
        if not calendar_id:
            raise ValueError("Configured Operator Calendar is required")
        if demo_event_id is not None and (not demo_event_id or demo_event_id.startswith("p1b")):
            raise ValueError("Dedicated Operator Calendar resource is invalid")
        try:
            ZoneInfo(timezone)
        except ZoneInfoNotFoundError as error:
            raise ValueError("Operator Calendar timezone must be a known IANA timezone") from error
        self._calendar_id = calendar_id
        self._demo_event_id = demo_event_id
        self.timezone = timezone
        self.resource_identifiers: tuple[str, ...] = (
            *((demo_event_id,) if demo_event_id else ()),
            CALENDAR_CREATE_RESOURCE,
        )
        self._gateway = gateway

    def permits_target(self, target: OperatorTarget) -> bool:
        return (
            target.authority == "GOOGLE_CALENDAR"
            and target.resource_type == "EVENT"
            and target.resource_identifier in self.resource_identifiers
        )

    def _event(self, target: OperatorTarget) -> dict[str, Any]:
        if not self.permits_target(target) or target.resource_identifier != self._demo_event_id:
            raise OperatorAdapterError("calendar_target_not_permitted")
        try:
            value = self._gateway.get_event(self._calendar_id, self._demo_event_id)
        except CalendarAdapterError as error:
            raise OperatorAdapterError(error.category.value) from error
        if value is None:
            raise OperatorAdapterError("calendar_resource_missing")
        extended = value.get("extendedProperties")
        private = extended.get("private") if isinstance(extended, dict) else None
        if (
            value.get("id") != self._demo_event_id
            or not isinstance(private, dict)
            or private.get("reflow_resource") != "operator_demo"
            or value.get("attendees")
            or value.get("recurrence")
            or value.get("recurringEventId")
            or value.get("status") != "confirmed"
        ):
            raise OperatorAdapterError("calendar_not_isolated_operator_demo")
        return value

    @staticmethod
    def _date_time(value: Any) -> str | None:
        return (
            str(value.get("dateTime"))
            if isinstance(value, dict) and value.get("dateTime")
            else None
        )

    def inspect(self, target: OperatorTarget) -> dict[str, str | None]:
        if target.resource_identifier == CALENDAR_CREATE_RESOURCE and self.permits_target(target):
            return {
                "calendar_scope": CALENDAR_CREATE_RESOURCE,
                "timezone": self.timezone,
                "creation": "available",
            }
        value = self._event(target)
        return {
            "event_id": self._demo_event_id,
            "title": str(value.get("summary") or ""),
            "description": str(value.get("description") or ""),
            "start": self._date_time(value.get("start")),
            "end": self._date_time(value.get("end")),
            "status": str(value.get("status")) if value.get("status") else None,
            "etag": str(value.get("etag")) if value.get("etag") else None,
        }

    def execute(
        self,
        action_id: str,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
        proposal: dict[str, str],
    ) -> AdapterExecution:
        self.propose(target, operations, current)
        if (
            target.resource_identifier == CALENDAR_CREATE_RESOURCE
            and len(operations) == 1
            and operations[0].operation == CALENDAR_CREATE_OPERATION
        ):
            event = operations[0].calendar_event
            if event is None:
                raise OperatorAdapterError("calendar_create_contract_required")
            fingerprint = hashlib.sha256(event.model_dump_json().encode()).hexdigest()
            if proposal.get("event_fingerprint") != fingerprint:
                raise OperatorAdapterError("calendar_create_proposal_changed")
            external_event_id = calendar_event_id(action_id)
            try:
                acknowledgement = self._gateway.get_event(self._calendar_id, external_event_id)
                if acknowledgement is None:
                    try:
                        acknowledgement = self._gateway.insert_operator_event(
                            self._calendar_id,
                            external_event_id,
                            action_id,
                            event,
                        )
                    except CalendarAdapterError as error:
                        if error.category is not CalendarErrorCategory.CONFLICT:
                            raise
                        acknowledgement = self._gateway.get_event(
                            self._calendar_id, external_event_id
                        )
                        if acknowledgement is None:
                            raise OperatorAdapterError(
                                "calendar_conflict_without_existing_event"
                            ) from error
            except CalendarAdapterError as error:
                raise OperatorAdapterError(error.category.value) from error
            self._created_event_state(acknowledgement, external_event_id, action_id)
            return AdapterExecution(
                expected_state={
                    "event_id": external_event_id,
                    "title": event.summary,
                    "description": event.description,
                    "location": event.location,
                    "start": event.start,
                    "end": event.end,
                    "start_timezone": event.timezone,
                    "end_timezone": event.timezone,
                    "reminders": canonical_reminders(reminder_payload(event.reminders)),
                    "status": "confirmed",
                },
                acknowledgement={
                    "event_id": external_event_id,
                    "action_id": action_id,
                    "etag": str(acknowledgement.get("etag") or "unavailable"),
                    "operation": "created",
                    "write": "acknowledged",
                },
            )
        if target.resource_identifier != self._demo_event_id:
            raise OperatorAdapterError("calendar_update_target_not_permitted")
        start_value = current.get("start")
        end_value = current.get("end")
        if not start_value or not end_value:
            raise OperatorAdapterError("calendar_timed_event_required")
        try:
            start = datetime.fromisoformat(start_value)
            end = datetime.fromisoformat(end_value)
            if start.tzinfo is None or end.tzinfo is None or end <= start:
                raise ValueError
        except ValueError as error:
            raise OperatorAdapterError("calendar_event_time_invalid") from error
        payload: dict[str, object] = {}
        expected: dict[str, str | None] = {}
        for item in operations:
            value = item.value or ""
            if item.operation == "CALENDAR_RESCHEDULE":
                if value.lstrip("+-").isdigit():
                    shifted_start = start + timedelta(minutes=int(value))
                else:
                    try:
                        shifted_start = datetime.fromisoformat(value)
                        if shifted_start.tzinfo is None:
                            raise ValueError
                    except ValueError as error:
                        raise OperatorAdapterError("calendar_time_invalid") from error
                shifted_end = shifted_start + (end - start)
                expected["start"] = shifted_start.isoformat()
                expected["end"] = shifted_end.isoformat()
                payload["start"] = {"dateTime": shifted_start.isoformat()}
                payload["end"] = {"dateTime": shifted_end.isoformat()}
            elif item.operation == "CALENDAR_UPDATE_TITLE":
                expected["title"] = value
                payload["summary"] = value
            elif item.operation == "CALENDAR_UPDATE_DESCRIPTION":
                expected["description"] = value
                payload["description"] = value
            else:
                raise OperatorAdapterError("calendar_operation_not_supported")
        try:
            acknowledgement = self._gateway.patch_event(
                self._calendar_id,
                self._demo_event_id,
                payload,
                current.get("etag"),
            )
        except CalendarAdapterError as error:
            raise OperatorAdapterError(error.category.value) from error
        return AdapterExecution(
            expected,
            {
                "event_id": self._demo_event_id,
                "etag": str(acknowledgement.get("etag") or "unavailable"),
                "write": "acknowledged",
            },
        )

    def propose(
        self,
        target: OperatorTarget,
        operations: tuple[RequestedOperation, ...],
        current: dict[str, str | None],
    ) -> dict[str, str]:
        if not self.permits_target(target):
            raise OperatorAdapterError("calendar_target_not_permitted")
        if target.resource_identifier == CALENDAR_CREATE_RESOURCE:
            if (
                len(operations) != 1
                or operations[0].operation != CALENDAR_CREATE_OPERATION
                or operations[0].calendar_event is None
            ):
                raise OperatorAdapterError("calendar_create_operation_required")
            if current != {
                "calendar_scope": CALENDAR_CREATE_RESOURCE,
                "timezone": self.timezone,
                "creation": "available",
            }:
                raise OperatorAdapterError("calendar_create_scope_changed")
            event = operations[0].calendar_event
            if event.timezone != self.timezone:
                raise OperatorAdapterError("calendar_timezone_not_permitted")
            return {
                "event_fingerprint": hashlib.sha256(event.model_dump_json().encode()).hexdigest()
            }
        if any(item.operation == CALENDAR_CREATE_OPERATION for item in operations):
            raise OperatorAdapterError("calendar_create_target_not_permitted")
        if not current.get("etag"):
            raise OperatorAdapterError("calendar_etag_required")
        for item in operations:
            value = item.value or ""
            if item.operation not in self.operations:
                raise OperatorAdapterError("calendar_operation_not_supported")
            if (
                item.operation == "CALENDAR_RESCHEDULE"
                and value.lstrip("+-").isdigit()
                and not 0 < abs(int(value)) <= 480
            ):
                raise OperatorAdapterError("calendar_shift_outside_safe_bounds")
            if item.operation != "CALENDAR_RESCHEDULE" or value.lstrip("+-").isdigit():
                continue
            try:
                requested = datetime.fromisoformat(value)
                existing = datetime.fromisoformat(current.get("start") or "")
                if requested.tzinfo is None or existing.tzinfo is None:
                    raise ValueError
            except ValueError as error:
                raise OperatorAdapterError("calendar_time_invalid") from error
            if abs((requested - existing).total_seconds()) > 480 * 60:
                raise OperatorAdapterError("calendar_shift_outside_safe_bounds")
        return {}

    def read_back(
        self, target: OperatorTarget, acknowledgement: dict[str, str]
    ) -> dict[str, str | None]:
        if acknowledgement.get("operation") == "created":
            event_id = acknowledgement.get("event_id")
            action_id = acknowledgement.get("action_id")
            if not event_id or not action_id:
                raise OperatorAdapterError("calendar_create_acknowledgement_invalid")
            try:
                value = self._gateway.get_event(self._calendar_id, event_id)
            except CalendarAdapterError as error:
                raise OperatorAdapterError(error.category.value) from error
            if value is None:
                raise OperatorAdapterError("calendar_created_event_missing")
            return self._created_event_state(value, event_id, action_id)
        return self.inspect(target)

    @staticmethod
    def _created_event_state(
        value: dict[str, Any], event_id: str, action_id: str
    ) -> dict[str, str | None]:
        extended = value.get("extendedProperties")
        private = extended.get("private") if isinstance(extended, dict) else None
        if (
            value.get("id") != event_id
            or not isinstance(private, dict)
            or private.get("reflow_resource") != "operator_created"
            or private.get("reflow_action_id") != action_id
        ):
            raise OperatorAdapterError("calendar_created_event_correlation_mismatch")
        start = value.get("start")
        end = value.get("end")
        if not isinstance(start, dict) or not isinstance(end, dict):
            raise OperatorAdapterError("calendar_created_event_time_missing")
        return {
            "event_id": event_id,
            "title": str(value.get("summary") or ""),
            "description": (
                str(value["description"]) if value.get("description") is not None else None
            ),
            "location": str(value["location"]) if value.get("location") is not None else None,
            "start": str(start.get("dateTime") or ""),
            "end": str(end.get("dateTime") or ""),
            "start_timezone": str(start.get("timeZone") or ""),
            "end_timezone": str(end.get("timeZone") or ""),
            "reminders": canonical_reminders(value.get("reminders")),
            "status": str(value.get("status") or ""),
        }

    def verify(
        self, expected: dict[str, str | None], observed: dict[str, str | None]
    ) -> tuple[bool, dict[str, str]]:
        def matches(key: str, value: str | None) -> bool:
            actual = observed.get(key)
            if key in {"start", "end"}:
                try:
                    return datetime.fromisoformat(value or "") == datetime.fromisoformat(
                        actual or ""
                    )
                except ValueError:
                    return False
            return actual == value

        differences = [key for key, value in expected.items() if not matches(key, value)]
        return not differences, {
            "comparison": "PASSED" if not differences else "FAILED",
            "difference_count": str(len(differences)),
        }
