"""Suppress SDK content-bearing diagnostic logs only inside Operator invocations."""

import logging
from contextvars import ContextVar

operator_active: ContextVar[bool] = ContextVar("operator_active", default=False)


class OperatorPrivacyFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        # ADK validation exception text can include untrusted model output. P2F
        # emits its own categorized metadata-only failure instead. P2C is unaffected.
        return not (
            operator_active.get() and record.name.startswith(("google_adk", "google.genai"))
        )


_filter = OperatorPrivacyFilter()


def install_operator_privacy_filter() -> None:
    for handler in logging.getLogger().handlers:
        handler.addFilter(_filter)
