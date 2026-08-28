"""Firebase product-session verification and workspace classification."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Protocol, cast

import firebase_admin  # type: ignore[import-untyped]
from firebase_admin import auth


class InvalidSessionError(Exception):
    """Raised when a Firebase credential cannot establish a product session."""


class SessionGateway(Protocol):
    def verify_id_token(self, token: str) -> Mapping[str, Any]: ...

    def create_session_cookie(self, token: str, expires_in: timedelta) -> str: ...

    def verify_session_cookie(self, cookie: str) -> Mapping[str, Any]: ...


class FirebaseSessionGateway:
    """Firebase Admin adapter. Application Default Credentials stay server-side."""

    def __init__(self) -> None:
        try:
            firebase_admin.get_app()
        except ValueError:
            firebase_admin.initialize_app()

    def verify_id_token(self, token: str) -> Mapping[str, Any]:
        try:
            return cast(Mapping[str, Any], auth.verify_id_token(token, check_revoked=True))
        except (
            ValueError,
            auth.InvalidIdTokenError,
            auth.ExpiredIdTokenError,
            auth.RevokedIdTokenError,
        ) as error:
            raise InvalidSessionError("The Firebase ID token is invalid or expired.") from error

    def create_session_cookie(self, token: str, expires_in: timedelta) -> str:
        try:
            return cast(str, auth.create_session_cookie(token, expires_in=expires_in))
        except (ValueError, auth.InvalidIdTokenError) as error:
            raise InvalidSessionError("The Firebase session could not be created.") from error

    def verify_session_cookie(self, cookie: str) -> Mapping[str, Any]:
        try:
            return cast(Mapping[str, Any], auth.verify_session_cookie(cookie, check_revoked=True))
        except (
            ValueError,
            auth.InvalidSessionCookieError,
            auth.ExpiredSessionCookieError,
            auth.RevokedSessionCookieError,
        ) as error:
            raise InvalidSessionError("The Firebase session is invalid or expired.") from error


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
