"""Least-privilege Gmail REST gateway backed by a Secret Manager OAuth refresh grant."""

from __future__ import annotations

import json
import random
import time
from collections.abc import Callable
from typing import Any, Protocol
from urllib.parse import quote

from google.api_core.exceptions import GoogleAPIError, NotFound
from google.auth.exceptions import RefreshError, TransportError
from google.auth.transport.requests import AuthorizedSession
from google.cloud import secretmanager
from google.oauth2.credentials import Credentials
from requests import exceptions as requests_exceptions

from objective_recovery_agent.gmail_contract import (
    GMAIL_READONLY_SCOPE,
    GmailHistoryPage,
    GmailMessageListPage,
    GmailProfile,
    GmailWatchResult,
)


class GmailGatewayError(RuntimeError):
    def __init__(self, category: str, *, retryable: bool, status_code: int | None = None) -> None:
        super().__init__(category)
        self.category = category
        self.retryable = retryable
        self.status_code = status_code


class GmailGateway(Protocol):
    def get_profile(self) -> GmailProfile: ...

    def watch(self, topic_name: str) -> GmailWatchResult: ...

    def list_history(self, start_history_id: str, page_token: str | None) -> GmailHistoryPage: ...

    def get_message(self, message_id: str) -> dict[str, Any]: ...

    def list_messages(self, page_token: str | None) -> GmailMessageListPage: ...


class SecretManagerCredentialProvider:
    def __init__(self, project_id: str, secret_id: str) -> None:
        self._resource = f"projects/{project_id}/secrets/{secret_id}/versions/latest"

    def load(self) -> Credentials:
        try:
            response = secretmanager.SecretManagerServiceClient().access_secret_version(
                request={"name": self._resource}
            )
        except NotFound as error:
            raise GmailGatewayError("gmail_oauth_secret_missing", retryable=False) from error
        except GoogleAPIError as error:
            raise GmailGatewayError("gmail_oauth_secret_access", retryable=True) from error
        try:
            payload = json.loads(response.payload.data.decode("utf-8"))
            credentials = Credentials.from_authorized_user_info(payload, [GMAIL_READONLY_SCOPE])
        except (UnicodeDecodeError, json.JSONDecodeError, ValueError, KeyError) as error:
            raise GmailGatewayError("invalid_oauth_secret", retryable=False) from error
        if set(credentials.scopes or ()) != {GMAIL_READONLY_SCOPE}:
            raise GmailGatewayError("unexpected_oauth_scope", retryable=False)
        return credentials


class GmailApiGateway:
    _BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

    def __init__(
        self,
        credentials: Credentials,
        *,
        max_attempts: int = 3,
        sleep: Callable[[float], None] = time.sleep,
        jitter: Callable[[], float] = random.random,
        session: Any | None = None,
    ) -> None:
        self._session = session or AuthorizedSession(credentials)
        self._max_attempts = max_attempts
        self._sleep = sleep
        self._jitter = jitter

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: list[tuple[str, str]] | None = None,
        body: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        for attempt in range(1, self._max_attempts + 1):
            try:
                response = self._session.request(
                    method,
                    f"{self._BASE}{path}",
                    params=params,
                    json=body,
                    timeout=20,
                )
            except RefreshError as error:
                message = str(error).casefold()
                permanent = "invalid_grant" in message or "revoked" in message
                raise GmailGatewayError(
                    "oauth_grant_invalid" if permanent else "oauth_refresh_transient",
                    retryable=not permanent,
                ) from error
            except (
                TransportError,
                requests_exceptions.Timeout,
                requests_exceptions.ConnectionError,
            ) as error:
                if attempt == self._max_attempts:
                    raise GmailGatewayError("gmail_transport", retryable=True) from error
                self._sleep((2 ** (attempt - 1)) + self._jitter())
                continue

            status_code = int(response.status_code)
            if 200 <= status_code < 300:
                try:
                    value = response.json()
                except ValueError as error:
                    raise GmailGatewayError(
                        "gmail_invalid_json", retryable=False, status_code=status_code
                    ) from error
                if not isinstance(value, dict):
                    raise GmailGatewayError(
                        "gmail_invalid_json", retryable=False, status_code=status_code
                    )
                return value

            retryable = status_code == 429 or status_code in {500, 502, 503, 504}
            if retryable and attempt < self._max_attempts:
                self._sleep((2 ** (attempt - 1)) + self._jitter())
                continue
            category = {
                401: "oauth_grant_invalid",
                403: "gmail_permission_denied",
                404: "gmail_not_found",
            }.get(status_code, "gmail_transient" if retryable else "gmail_request_rejected")
            raise GmailGatewayError(category, retryable=retryable, status_code=status_code)

        raise AssertionError("bounded Gmail retry loop exhausted")

    def get_profile(self) -> GmailProfile:
        return GmailProfile.model_validate(self._request("GET", "/profile"))

    def watch(self, topic_name: str) -> GmailWatchResult:
        return GmailWatchResult.model_validate(
            self._request(
                "POST",
                "/watch",
                body={
                    "topicName": topic_name,
                    "labelIds": ["INBOX"],
                    "labelFilterBehavior": "INCLUDE",
                },
            )
        )

    def list_history(self, start_history_id: str, page_token: str | None) -> GmailHistoryPage:
        params = [
            ("startHistoryId", start_history_id),
            ("historyTypes", "messageAdded"),
            ("labelId", "INBOX"),
            ("maxResults", "400"),
        ]
        if page_token:
            params.append(("pageToken", page_token))
        return GmailHistoryPage.model_validate(self._request("GET", "/history", params=params))

    def get_message(self, message_id: str) -> dict[str, Any]:
        return self._request(
            "GET",
            f"/messages/{quote(message_id, safe='')}",
            params=[("format", "full")],
        )

    def list_messages(self, page_token: str | None) -> GmailMessageListPage:
        params = [("labelIds", "INBOX"), ("maxResults", "500")]
        if page_token:
            params.append(("pageToken", page_token))
        return GmailMessageListPage.model_validate(self._request("GET", "/messages", params=params))
