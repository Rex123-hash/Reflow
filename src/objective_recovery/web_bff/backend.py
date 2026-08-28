"""Audience-bound service-to-service client for the private recovery backend."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Protocol

import requests
from google.auth.transport.requests import Request
from google.oauth2 import id_token


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

    def __init__(self, backend_base_url: str) -> None:
        self._base_url = backend_base_url.rstrip("/")
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
            self._auth_request, self._base_url
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
