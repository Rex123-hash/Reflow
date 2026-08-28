"""Firebase product-session verification and workspace classification."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Protocol, cast

import firebase_admin  # type: ignore[import-untyped]
import requests
from firebase_admin import auth


class InvalidSessionError(Exception):
    """Raised when a Firebase credential cannot establish a product session."""


class SessionGateway(Protocol):
    def verify_id_token(self, token: str) -> Mapping[str, Any]: ...

    def create_session_cookie(self, token: str, expires_in: timedelta) -> str: ...

    def verify_session_cookie(self, cookie: str) -> Mapping[str, Any]: ...


class FirebaseSessionGateway:
    """Short-lived Firebase ID-token session with token-bound revocation checks."""

    def __init__(self, web_api_key: str, http_session: requests.Session | None = None) -> None:
        if not web_api_key:
            raise ValueError("Firebase web API key is required.")
        self._web_api_key = web_api_key
        self._http = http_session or requests.Session()
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app()

    def verify_id_token(self, token: str) -> Mapping[str, Any]:
        try:
            claims = cast(Mapping[str, Any], auth.verify_id_token(token, check_revoked=False))
        except (
            ValueError,
            auth.InvalidIdTokenError,
            auth.ExpiredIdTokenError,
        ) as error:
            raise InvalidSessionError("The Firebase ID token is invalid or expired.") from error
        try:
            response = self._http.post(
                "https://identitytoolkit.googleapis.com/v1/accounts:lookup",
                params={"key": self._web_api_key},
                json={"idToken": token},
                timeout=(3.05, 10),
            )
            payload = response.json() if response.status_code == 200 else {}
        except (requests.RequestException, ValueError) as error:
            raise InvalidSessionError("Firebase could not validate the active session.") from error
        users = payload.get("users") if isinstance(payload, Mapping) else None
        uid = claims.get("uid") or claims.get("sub")
        if (
            response.status_code != 200
            or not isinstance(users, list)
            or len(users) != 1
            or not isinstance(users[0], Mapping)
            or users[0].get("localId") != uid
        ):
            raise InvalidSessionError("The Firebase ID token is revoked or inactive.")
        return claims

    def create_session_cookie(self, token: str, expires_in: timedelta) -> str:
        if not token or expires_in <= timedelta(0) or expires_in > timedelta(minutes=55):
            raise InvalidSessionError("The Firebase session duration is invalid.")
        # The verified, one-hour Firebase ID token becomes a shorter-lived, same-origin,
        # HttpOnly bearer. It is never forwarded to the private recovery backend.
        return token

    def verify_session_cookie(self, cookie: str) -> Mapping[str, Any]:
        return self.verify_id_token(cookie)


@dataclass(frozen=True)
class SessionPrincipal:
    uid: str
    mode: str
    email: str | None
    display_name: str | None


def principal_from_claims(claims: Mapping[str, Any]) -> SessionPrincipal:
    uid = claims.get("uid") or claims.get("sub")
    firebase_claim = claims.get("firebase")
    provider = (
        firebase_claim.get("sign_in_provider") if isinstance(firebase_claim, Mapping) else None
    )
    if not isinstance(uid, str) or not uid:
        raise InvalidSessionError("The Firebase session has no subject.")
    if provider == "anonymous":
        mode = "guest"
    elif provider == "google.com":
        mode = "live"
    else:
        raise InvalidSessionError("This sign-in provider is not enabled for Reflow.")
    email = claims.get("email")
    display_name = claims.get("name")
    return SessionPrincipal(
        uid=uid,
        mode=mode,
        email=email if isinstance(email, str) else None,
        display_name=display_name if isinstance(display_name, str) else None,
    )
