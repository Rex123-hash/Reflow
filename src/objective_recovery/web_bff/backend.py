"""Audience-bound service-to-service client for the private recovery backend."""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

import requests
from google.auth.transport.requests import Request
from google.oauth2 import id_token

_VOICE_SESSION_PATHS = {
    "TRANSCRIPTION": "/api/v1/voice/transcription/session",
    "LIVE_CALL": "/api/v1/voice/live/session",
}


@dataclass(frozen=True)
class BackendResponse:
    status_code: int
    body: bytes
    headers: Mapping[str, str]


class BackendGateway(Protocol):
    def get(
        self,
        path: str,
        query: Mapping[str, str | int],
        if_none_match: str | None,
    ) -> BackendResponse: ...


class GoogleIdentityBackendGateway:
    """Invokes one fixed backend origin with a server-minted audience ID token."""

    def __init__(self, backend_base_url: str, *, audience: str | None = None) -> None:
        self._base_url = backend_base_url.rstrip("/")
        self._audience = (audience or self._base_url).rstrip("/")
        self._session = requests.Session()
        self._auth_request = Request()

    def get(
        self,
        path: str,
        query: Mapping[str, str | int],
        if_none_match: str | None,
    ) -> BackendResponse:
        if not path.startswith("/api/v1/ui/") or "://" in path:
            raise ValueError("The BFF only invokes allowlisted presentation paths.")
        audience_token = id_token.fetch_id_token(  # type: ignore[no-untyped-call]
            self._auth_request, self._audience
        )
        headers = {"Authorization": f"Bearer {audience_token}"}
        if if_none_match:
            headers["If-None-Match"] = if_none_match
        response = self._session.get(
            f"{self._base_url}{path}",
            params=query,
            headers=headers,
            timeout=(3.05, 20),
        )
        return BackendResponse(
            status_code=response.status_code,
            body=response.content,
            headers=response.headers,
        )

    def query_operator(
        self, payload: bytes, subject: str, request_id: str, role: str = "VIEWER"
    ) -> BackendResponse:
        """The sole admitted POST; no caller-controlled path, URL, auth, or execution endpoint."""
        audience_token = id_token.fetch_id_token(  # type: ignore[no-untyped-call]
            self._auth_request, self._audience
        )
        response = self._session.post(
            f"{self._base_url}/api/v1/operator/query",
            data=payload,
            headers={
                "Authorization": f"Bearer {audience_token}",
                "Content-Type": "application/json",
                "X-Reflow-Operator-Subject": subject,
                "X-Reflow-Request-Id": request_id,
                "X-Reflow-Operator-Role": role,
            },
            timeout=(3.05, 85),
            allow_redirects=False,
        )
        return BackendResponse(response.status_code, response.content, response.headers)

    def create_voice_session(
        self, capability: str, payload: bytes, subject: str, request_id: str
    ) -> BackendResponse:
        """Two fixed paths that mint a constrained voice credential and nothing else."""
        path = _VOICE_SESSION_PATHS.get(capability)
        if path is None:
            raise ValueError("Unknown voice capability")
        audience_token = id_token.fetch_id_token(  # type: ignore[no-untyped-call]
            self._auth_request, self._audience
        )
        response = self._session.post(
            f"{self._base_url}{path}",
            data=payload,
            headers={
                "Authorization": f"Bearer {audience_token}",
                "Content-Type": "application/json",
                "X-Reflow-Operator-Subject": subject,
                "X-Reflow-Request-Id": request_id,
            },
            timeout=(3.05, 20),
            allow_redirects=False,
        )
        return BackendResponse(response.status_code, response.content, response.headers)

    def approve_operator(
        self, action_id: str, subject: str, request_id: str, role: str
    ) -> BackendResponse:
        if not re.fullmatch(r"[a-f0-9]{64}", action_id):
            raise ValueError("Invalid fixed-path action identifier")
        audience_token = id_token.fetch_id_token(  # type: ignore[no-untyped-call]
            self._auth_request, self._audience
        )
        response = self._session.post(
            f"{self._base_url}/api/v1/operator/actions/{action_id}/approve",
            data=b"{}",
            headers={
                "Authorization": f"Bearer {audience_token}",
                "Content-Type": "application/json",
                "X-Reflow-Operator-Subject": subject,
                "X-Reflow-Request-Id": request_id,
                "X-Reflow-Operator-Role": role,
            },
            timeout=(3.05, 50),
            allow_redirects=False,
        )
        return BackendResponse(response.status_code, response.content, response.headers)
