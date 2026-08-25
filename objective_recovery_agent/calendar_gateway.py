"""Scoped Google Calendar REST adapter for P1B."""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Protocol, cast
from urllib.parse import quote

import google.auth
from google.auth import impersonated_credentials
from google.auth.transport.requests import AuthorizedSession
from requests import Response
from requests.exceptions import RequestException

from objective_recovery_agent.calendar_contract import (
    CalendarActionIntent,
    CalendarWriteAcknowledgement,
)

CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events"


class CalendarErrorCategory(StrEnum):
    AUTHENTICATION = "calendar_authentication"
    PERMISSION = "calendar_permission"
    INVALID_REQUEST = "calendar_invalid_request"
    NOT_FOUND = "calendar_not_found"
    CONFLICT = "calendar_conflict"
    RATE_LIMIT = "calendar_rate_limit"
    SERVER = "calendar_server"
    TRANSPORT = "calendar_transport"
    UNKNOWN = "calendar_unknown"


class CalendarAdapterError(RuntimeError):
    def __init__(
        self,
        category: CalendarErrorCategory,
        *,
        retryable: bool,
        status_code: int | None = None,
    ) -> None:
        super().__init__(category.value)
        self.category = category
        self.retryable = retryable
        self.status_code = status_code


class CalendarGateway(Protocol):
    def insert_event(self, intent: CalendarActionIntent) -> CalendarWriteAcknowledgement: ...

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, object] | None: ...


def _error_reasons(response: Response) -> set[str]:
    try:
        payload = response.json()
    except ValueError:
        return set()
    if not isinstance(payload, dict):
        return set()
    error = payload.get("error")
    if not isinstance(error, dict):
        return set()
    errors = error.get("errors", [])
    if not isinstance(errors, list):
        return set()
    return {
        str(item.get("reason")) for item in errors if isinstance(item, dict) and item.get("reason")
    }


def _raise_for_calendar_error(response: Response) -> None:
    status = response.status_code
    reasons = _error_reasons(response)
    if status == 400:
        raise CalendarAdapterError(
            CalendarErrorCategory.INVALID_REQUEST, retryable=False, status_code=status
        )
    if status == 401:
        raise CalendarAdapterError(
            CalendarErrorCategory.AUTHENTICATION, retryable=False, status_code=status
        )
    if status == 403:
        retryable_reasons = {"rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded"}
        retryable = bool(reasons & retryable_reasons)
        raise CalendarAdapterError(
            CalendarErrorCategory.RATE_LIMIT if retryable else CalendarErrorCategory.PERMISSION,
            retryable=retryable,
            status_code=status,
        )
    if status == 404:
        raise CalendarAdapterError(
            CalendarErrorCategory.NOT_FOUND, retryable=True, status_code=status
        )
    if status == 409:
        raise CalendarAdapterError(
            CalendarErrorCategory.CONFLICT, retryable=False, status_code=status
        )
    if status == 429:
        raise CalendarAdapterError(
            CalendarErrorCategory.RATE_LIMIT, retryable=True, status_code=status
        )
    if 500 <= status < 600:
        raise CalendarAdapterError(CalendarErrorCategory.SERVER, retryable=True, status_code=status)
    raise CalendarAdapterError(CalendarErrorCategory.UNKNOWN, retryable=False, status_code=status)


class GoogleCalendarGateway:
    """Uses short-lived, Calendar-scoped service-account impersonation credentials."""

    def __init__(self, *, service_account_email: str) -> None:
        source_credentials, _ = google.auth.default()
        scoped_credentials = impersonated_credentials.Credentials(  # type: ignore[no-untyped-call]
            source_credentials=source_credentials,
            target_principal=service_account_email,
            target_scopes=[CALENDAR_EVENTS_SCOPE],
            lifetime=900,
        )
        self._session: AuthorizedSession = AuthorizedSession(  # type: ignore[no-untyped-call]
            scoped_credentials
        )

    @staticmethod
    def _event_url(calendar_id: str, event_id: str | None = None) -> str:
        base = (
            f"https://www.googleapis.com/calendar/v3/calendars/{quote(calendar_id, safe='')}/events"
        )
        return f"{base}/{quote(event_id, safe='')}" if event_id else base

    def _request(self, method: str, url: str, **kwargs: Any) -> Response:
        try:
            response = cast(
                Response,
                self._session.request(  # type: ignore[no-untyped-call]
                    method, url, timeout=20, **kwargs
                ),
            )
        except RequestException as error:
            raise CalendarAdapterError(CalendarErrorCategory.TRANSPORT, retryable=True) from error
        if not response.ok:
            _raise_for_calendar_error(response)
        return response

    def insert_event(self, intent: CalendarActionIntent) -> CalendarWriteAcknowledgement:
        desired = intent.desired
        payload = {
            "id": intent.event_id,
            "summary": desired.summary,
            "description": desired.description,
            "start": {"dateTime": desired.start},
            "end": {"dateTime": desired.end},
            "status": desired.status,
            "visibility": desired.visibility,
            "transparency": desired.transparency,
            "extendedProperties": {"private": desired.private_extended_properties},
        }
        response = self._request(
            "POST",
            self._event_url(intent.calendar_id),
            params={"sendUpdates": "none"},
            json=payload,
        )
        body = response.json()
        if not isinstance(body, dict) or body.get("id") != intent.event_id:
            raise CalendarAdapterError(CalendarErrorCategory.UNKNOWN, retryable=False)
        return CalendarWriteAcknowledgement(
            event_id=intent.event_id,
            etag=str(body["etag"]) if body.get("etag") is not None else None,
        )

    def get_event(self, calendar_id: str, event_id: str) -> dict[str, object] | None:
        try:
            response = self._request("GET", self._event_url(calendar_id, event_id))
        except CalendarAdapterError as error:
            if error.category is CalendarErrorCategory.NOT_FOUND:
                return None
            raise
        body = response.json()
        if not isinstance(body, dict):
            raise CalendarAdapterError(CalendarErrorCategory.UNKNOWN, retryable=False)
        return body
