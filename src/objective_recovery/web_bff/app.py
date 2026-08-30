"""P2D public BFF: Firebase session boundary over the private presentation API."""

import json
import os
import time
from collections.abc import Awaitable, Callable, Mapping
from datetime import timedelta
from typing import Annotated

import requests
from fastapi import (
    Cookie,
    Depends,
    FastAPI,
    Header,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from fastapi.responses import JSONResponse
from objective_recovery_agent.external_reality_schemas import ExternalRealityView
from objective_recovery_agent.ui_schemas import (
    EvidencePageView,
    ExecutionEventsView,
    ObjectiveFilter,
    ObjectivesView,
    OperatorContextView,
    OverviewView,
    RecoveryCaseView,
)
from pydantic import BaseModel, ConfigDict

from objective_recovery.web_bff.auth import (
    FirebaseSessionGateway,
    InvalidSessionError,
    SessionGateway,
    SessionPrincipal,
    principal_from_claims,
)
from objective_recovery.web_bff.backend import BackendGateway, GoogleIdentityBackendGateway
from objective_recovery.web_bff.config import BffSettings
from objective_recovery.web_bff.demo import DemoResourceNotFoundError, DemoStore
from objective_recovery.web_bff.image import register_image_route
from objective_recovery.web_bff.operator import register_operator_route
from objective_recovery.web_bff.voice import register_voice_routes


class SessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_token: str


class SessionView(BaseModel):
    mode: str
    workspace_label: str
    email: str | None = None
    display_name: str | None = None
    read_only: bool


def _session_view(principal: SessionPrincipal) -> SessionView:
    return SessionView(
        mode=principal.mode,
        workspace_label="Live workspace"
        if principal.mode == "live"
        else "Demo workspace · Safe mode",
        email=principal.email,
        display_name=principal.display_name,
        read_only=principal.mode == "guest",
    )


def _validated_json(resource: str, body: bytes) -> str:
    if resource == "external-reality":
        return ExternalRealityView.model_validate_json(body).model_dump_json()
    if resource == "overview":
        return OverviewView.model_validate_json(body).model_dump_json()
    if resource == "objectives":
        return ObjectivesView.model_validate_json(body).model_dump_json()
    if resource == "recovery":
        return RecoveryCaseView.model_validate_json(body).model_dump_json()
    if resource == "evidence":
        return EvidencePageView.model_validate_json(body).model_dump_json()
    if resource == "events":
        return ExecutionEventsView.model_validate_json(body).model_dump_json()
    if resource == "operator":
        return OperatorContextView.model_validate_json(body).model_dump_json()
    raise ValueError("Unknown presentation resource.")


def create_app(
    settings: BffSettings,
    sessions: SessionGateway,
    backend: BackendGateway,
    demo: DemoStore,
    *,
    clock: Callable[[], float] = time.time,
    voice_backend: BackendGateway | None = None,
) -> FastAPI:
    app = FastAPI(
        title="Reflow Web Access BFF",
        version="0.1.0",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        )
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    def require_allowed_origin(origin: Annotated[str | None, Header()] = None) -> None:
        if origin is None or origin.rstrip("/") not in settings.allowed_origins:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Origin rejected.")

    def require_principal(
        cookie: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
    ) -> SessionPrincipal:
        if not cookie:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required."
            )
        try:
            return principal_from_claims(sessions.verify_session_cookie(cookie))
        except InvalidSessionError as error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="The session is invalid or expired.",
            ) from error

    def presentation_response(
        principal: SessionPrincipal,
        resource: str,
        path: str,
        query: Mapping[str, str | int],
        if_none_match: str | None,
        *,
        incident_id: str | None = None,
        selected_filter: ObjectiveFilter = ObjectiveFilter.ALL,
        after: int = 0,
        limit: int = 100,
    ) -> Response:
        workspace_headers = {
            "X-Reflow-Workspace": principal.mode,
            "Vary": "Cookie, If-None-Match",
        }
        if principal.mode == "guest":
            try:
                revision, body = demo.get(
                    resource,
                    incident_id=incident_id,
                    selected_filter=selected_filter,
                    after=after,
                    limit=limit,
                )
            except DemoResourceNotFoundError as error:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail={"code": "resource_not_found", "message": str(error.args[0])},
                ) from error
            except ValueError as error:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"code": "malformed_request", "message": str(error)},
                ) from error
            etag = f'W/"{revision}"'
            headers = {
                **workspace_headers,
                "ETag": etag,
                "Cache-Control": "private, no-cache",
            }
            if if_none_match == etag:
                return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
            return Response(content=body, media_type="application/json", headers=headers)

        try:
            upstream = backend.get(path, query, if_none_match)
        except (requests.RequestException, ValueError) as error:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail={
                    "code": "transport_failure",
                    "message": "The presentation service is temporarily unavailable.",
                },
            ) from error
        headers = dict(workspace_headers)
        for name in ("ETag", "Cache-Control"):
            value = upstream.headers.get(name)
            if value:
                headers[name] = value
        if upstream.status_code == status.HTTP_304_NOT_MODIFIED:
            return Response(status_code=status.HTTP_304_NOT_MODIFIED, headers=headers)
        if upstream.status_code != status.HTTP_200_OK:
            try:
                error_body = json.loads(upstream.body)
            except (UnicodeDecodeError, json.JSONDecodeError):
                error_body = {
                    "detail": {
                        "code": "backend_infrastructure_unavailable",
                        "message": "The presentation service returned an invalid response.",
                    }
                }
            return JSONResponse(
                status_code=upstream.status_code, content=error_body, headers=headers
            )
        try:
            validated = _validated_json(resource, upstream.body)
        except ValueError as error:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail={
                    "code": "backend_infrastructure_unavailable",
                    "message": "The presentation response failed contract validation.",
                },
            ) from error
        return Response(
            content=validated,
            media_type="application/json",
            headers=headers,
        )

    @app.get("/healthz")
    def health() -> dict[str, str]:
        return {"status": "ready", "boundary": "p2d-web-access"}

    @app.post("/api/auth/session", response_model=SessionView)
    def create_session(
        payload: SessionRequest,
        response: Response,
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> SessionView:
        try:
            claims = sessions.verify_id_token(payload.id_token)
            auth_time = claims.get("auth_time")
            if not isinstance(auth_time, (int, float)) or clock() - auth_time > 5 * 60:
                raise InvalidSessionError("Recent sign-in is required.")
            principal = principal_from_claims(claims)
            expires = timedelta(seconds=settings.session_ttl_seconds)
            cookie = sessions.create_session_cookie(payload.id_token, expires)
        except InvalidSessionError as error:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="The Firebase credential is invalid, expired, or unsupported.",
            ) from error
        response.set_cookie(
            settings.session_cookie_name,
            cookie,
            max_age=settings.session_ttl_seconds,
            httponly=True,
            secure=settings.secure_cookies,
            samesite="lax",
            path="/",
        )
        response.headers["Cache-Control"] = "no-store"
        return _session_view(principal)

    @app.get("/api/auth/session", response_model=SessionView)
    def read_session(
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
    ) -> SessionView:
        return _session_view(principal)

    @app.delete("/api/auth/session", status_code=status.HTTP_204_NO_CONTENT)
    def delete_session(
        response: Response,
        _: Annotated[None, Depends(require_allowed_origin)],
    ) -> Response:
        response.status_code = status.HTTP_204_NO_CONTENT
        response.delete_cookie(
            settings.session_cookie_name,
            httponly=True,
            secure=settings.secure_cookies,
            samesite="lax",
            path="/",
        )
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/v1/ui/overview")
    def overview(
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        if_none_match: Annotated[str | None, Header()] = None,
    ) -> Response:
        return presentation_response(
            principal, "overview", "/api/v1/ui/overview", {}, if_none_match
        )

    @app.get("/api/v1/ui/objectives")
    def objectives(
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        selected_filter: Annotated[ObjectiveFilter, Query(alias="status")] = ObjectiveFilter.ALL,
        if_none_match: Annotated[str | None, Header()] = None,
    ) -> Response:
        return presentation_response(
            principal,
            "objectives",
            "/api/v1/ui/objectives",
            {"status": selected_filter.value},
            if_none_match,
            selected_filter=selected_filter,
        )

    @app.get("/api/v1/ui/recoveries/{incident_id}")
    def recovery(
        incident_id: str,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        if_none_match: Annotated[str | None, Header()] = None,
    ) -> Response:
        return presentation_response(
            principal,
            "recovery",
            f"/api/v1/ui/recoveries/{incident_id}",
            {},
            if_none_match,
            incident_id=incident_id,
        )

    @app.get("/api/v1/ui/evidence/{incident_id}")
    def evidence(
        incident_id: str,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        if_none_match: Annotated[str | None, Header()] = None,
    ) -> Response:
        return presentation_response(
            principal,
            "evidence",
            f"/api/v1/ui/evidence/{incident_id}",
            {},
            if_none_match,
            incident_id=incident_id,
        )

    @app.get("/api/v1/ui/recoveries/{incident_id}/external-reality")
    def external_reality(
        incident_id: str,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
    ) -> Response:
        response = presentation_response(
            principal,
            "external-reality",
            f"/api/v1/ui/recoveries/{incident_id}/external-reality",
            {},
            None,
            incident_id=incident_id,
        )
        response.headers["Cache-Control"] = "no-store"
        if "etag" in response.headers:
            del response.headers["etag"]
        return response

    @app.get("/api/v1/ui/recoveries/{incident_id}/events")
    def events(
        incident_id: str,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        after: Annotated[int, Query(ge=0)] = 0,
        limit: Annotated[int, Query(ge=1, le=200)] = 100,
        if_none_match: Annotated[str | None, Header()] = None,
    ) -> Response:
        return presentation_response(
            principal,
            "events",
            f"/api/v1/ui/recoveries/{incident_id}/events",
            {"after": after, "limit": limit},
            if_none_match,
            incident_id=incident_id,
            after=after,
            limit=limit,
        )

    @app.get("/api/v1/ui/operator/context")
    def operator(
        incident_id: str,
        principal: Annotated[SessionPrincipal, Depends(require_principal)],
        if_none_match: Annotated[str | None, Header()] = None,
    ) -> Response:
        return presentation_response(
            principal,
            "operator",
            "/api/v1/ui/operator/context",
            {"incident_id": incident_id},
            if_none_match,
            incident_id=incident_id,
        )

    register_operator_route(app, backend, require_principal, require_allowed_origin)
    register_image_route(app, backend, require_principal, require_allowed_origin)
    register_voice_routes(
        app, voice_backend or backend, backend, require_principal, require_allowed_origin
    )
    return app


def _production_app() -> FastAPI:
    settings = BffSettings.from_environment()
    backend = GoogleIdentityBackendGateway(settings.backend_base_url)
    voice_backend = GoogleIdentityBackendGateway(
        settings.voice_backend_base_url or settings.backend_base_url,
        audience=settings.voice_backend_audience or settings.backend_base_url,
    )
    return create_app(
        settings,
        FirebaseSessionGateway(settings.firebase_web_api_key),
        backend,
        DemoStore(settings.demo_data_dir),
        voice_backend=voice_backend,
    )


app = _production_app() if os.getenv("K_SERVICE") else None
