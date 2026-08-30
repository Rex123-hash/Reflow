"""Typed, deterministic contract for human-directed Calendar event creation."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

CALENDAR_CREATE_RESOURCE = "configured-operator-calendar"
CALENDAR_CREATE_OPERATION = "CREATE_CALENDAR_EVENT"
MAX_CALENDAR_EVENT_DURATION = timedelta(hours=24)
MAX_CALENDAR_REMINDER_MINUTES = 40_320
MAX_CALENDAR_REMINDERS = 5

ReminderMinutes = Annotated[
    int,
    Field(strict=True, ge=0, le=MAX_CALENDAR_REMINDER_MINUTES),
]


class CalendarOperatorModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, revalidate_instances="always")


class CalendarReminder(CalendarOperatorModel):
    method: Literal["popup", "email"]
    minutes: ReminderMinutes


class CalendarReminderConfiguration(CalendarOperatorModel):
    use_default: bool
    overrides: tuple[CalendarReminder, ...] = Field(default=(), max_length=MAX_CALENDAR_REMINDERS)

    @model_validator(mode="after")
    def coherent_configuration(self) -> CalendarReminderConfiguration:
        if self.use_default and self.overrides:
            raise ValueError("Default reminders cannot include event-specific overrides")
        identities = {(item.method, item.minutes) for item in self.overrides}
        if len(identities) != len(self.overrides):
            raise ValueError("Duplicate Calendar reminders are not allowed")
        return self


class CalendarEventCreation(CalendarOperatorModel):
    summary: str = Field(min_length=1, max_length=200)
    start: str = Field(min_length=20, max_length=40)
    end: str = Field(min_length=20, max_length=40)
    timezone: str = Field(min_length=1, max_length=64)
    time_basis: Literal["ABSOLUTE", "RELATIVE"]
    duration_minutes: int | None = Field(default=None, strict=True, ge=1, le=1_440)
    description: str | None = Field(default=None, max_length=4_000)
    location: str | None = Field(default=None, max_length=500)
    reminders: CalendarReminderConfiguration = Field(
        default_factory=lambda: CalendarReminderConfiguration(use_default=True)
    )

    @field_validator("summary", "description", "location")
    @classmethod
    def safe_human_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if value != value.strip() or not value.strip():
            raise ValueError("Calendar text must be nonempty without surrounding whitespace")
        if any(ord(character) < 32 and character not in "\n\t" for character in value):
            raise ValueError("Calendar text cannot contain control characters")
        return value

    @model_validator(mode="after")
    def resolved_time_range(self) -> CalendarEventCreation:
        if "T" not in self.start or "T" not in self.end:
            raise ValueError("Calendar timestamps must be RFC3339 date-times")
        try:
            start = datetime.fromisoformat(self.start.replace("Z", "+00:00"))
            end = datetime.fromisoformat(self.end.replace("Z", "+00:00"))
        except ValueError as error:
            raise ValueError("Calendar timestamps must be valid RFC3339 date-times") from error
        if start.tzinfo is None or end.tzinfo is None:
            raise ValueError("Calendar timestamps require explicit UTC offsets")
        if end <= start:
            raise ValueError("Calendar event end must be after its start")
        duration = end - start
        if duration > MAX_CALENDAR_EVENT_DURATION:
            raise ValueError("Calendar event duration exceeds the 24-hour bound")
        if self.duration_minutes is not None and duration != timedelta(
            minutes=self.duration_minutes
        ):
            raise ValueError("Resolved timestamps do not match the requested duration")
        try:
            timezone = ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError as error:
            raise ValueError("Calendar timezone must be a known IANA timezone") from error
        for value in (start, end):
            represented = value.astimezone(timezone)
            if represented.utcoffset() != value.utcoffset():
                raise ValueError(
                    "Calendar timestamp offset does not match the timezone at that instant"
                )
        return self


def calendar_event_id(action_id: str) -> str:
    """Return a stable Calendar-compatible base32hex-alphabet identifier."""

    return "ref" + hashlib.sha256(action_id.encode()).hexdigest()


def reminder_payload(configuration: CalendarReminderConfiguration) -> dict[str, object]:
    payload: dict[str, object] = {"useDefault": configuration.use_default}
    if not configuration.use_default and configuration.overrides:
        payload["overrides"] = [
            {"method": item.method, "minutes": item.minutes} for item in configuration.overrides
        ]
    return payload


def canonical_reminders(value: object) -> str:
    """Normalize Calendar's reminder object for exact semantic read-back comparison."""

    if not isinstance(value, dict):
        return ""
    use_default = value.get("useDefault")
    overrides = value.get("overrides", [])
    if not isinstance(use_default, bool) or not isinstance(overrides, list):
        return ""
    normalized: list[dict[str, object]] = []
    for item in overrides:
        if not isinstance(item, dict):
            return ""
        method = item.get("method")
        minutes = item.get("minutes")
        if method not in {"popup", "email"} or not isinstance(minutes, int):
            return ""
        normalized.append({"method": method, "minutes": minutes})
    return json.dumps(
        {
            "useDefault": use_default,
            "overrides": sorted(
                normalized, key=lambda item: (str(item["method"]), int(item["minutes"]))
            ),
        },
        sort_keys=True,
        separators=(",", ":"),
    )
