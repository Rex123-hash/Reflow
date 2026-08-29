"""Configuration for the P2D Cloud Run browser-facing BFF."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class BffSettings:
    project_id: str
    backend_base_url: str
    allowed_origins: frozenset[str]
    demo_data_dir: Path
    voice_backend_base_url: str | None = None
    voice_backend_audience: str | None = None
    firebase_web_api_key: str = ""
    session_cookie_name: str = "__session"
    session_ttl_seconds: int = 55 * 60
    secure_cookies: bool = True

    @classmethod
    def from_environment(cls) -> BffSettings:
        project_id = os.environ.get("GOOGLE_CLOUD_PROJECT", "").strip()
        backend_base_url = os.environ.get("RECOVERY_BACKEND_URL", "").strip().rstrip("/")
        voice_backend_base_url = (
            os.environ.get("VOICE_RECOVERY_BACKEND_URL", "").strip().rstrip("/") or backend_base_url
        )
        voice_backend_audience = (
            os.environ.get("VOICE_RECOVERY_BACKEND_AUDIENCE", "").strip().rstrip("/")
            or backend_base_url
        )
        firebase_web_api_key = os.environ.get("FIREBASE_WEB_API_KEY", "").strip()
        allowed_origins = frozenset(
            value.strip().rstrip("/")
            for value in os.environ.get("ALLOWED_WEB_ORIGINS", "").split(",")
            if value.strip()
        )
        demo_default = Path(__file__).parents[3] / "docs" / "ui-fixtures"
        demo_data_dir = Path(os.environ.get("DEMO_DATA_DIR", str(demo_default)))
        missing = [
            name
            for name, value in (
                ("GOOGLE_CLOUD_PROJECT", project_id),
                ("RECOVERY_BACKEND_URL", backend_base_url),
                ("ALLOWED_WEB_ORIGINS", allowed_origins),
                ("FIREBASE_WEB_API_KEY", firebase_web_api_key),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(f"Missing BFF configuration: {', '.join(missing)}")
        return cls(
            project_id=project_id,
            backend_base_url=backend_base_url,
            voice_backend_base_url=voice_backend_base_url,
            voice_backend_audience=voice_backend_audience,
            allowed_origins=allowed_origins,
            demo_data_dir=demo_data_dir,
            firebase_web_api_key=firebase_web_api_key,
            secure_cookies=os.environ.get("SECURE_SESSION_COOKIE", "true").casefold() != "false",
        )
