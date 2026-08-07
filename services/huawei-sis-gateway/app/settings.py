from __future__ import annotations

import os
from dataclasses import dataclass


def _get_int(name: str, default: int, minimum: int = 1) -> int:
    value = int(os.getenv(name, str(default)))
    if value < minimum:
        raise ValueError(f"{name} must be at least {minimum}")
    return value


def _get_origins() -> tuple[str, ...]:
    raw_origins = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return tuple(
        origin.strip().rstrip("/")
        for origin in raw_origins.split(",")
        if origin.strip()
    )


@dataclass(frozen=True, slots=True)
class Settings:
    sis_ak: str = ""
    sis_sk: str = ""
    sis_project_id: str = ""
    sis_region: str = "ap-southeast-3"
    sis_endpoint: str = "sis-ext.ap-southeast-3.myhuaweicloud.com"
    allowed_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    )
    public_websocket_url: str = ""
    session_ttl_seconds: int = 60
    max_connections_per_ip: int = 2
    max_session_seconds: int = 3600

    @property
    def sis_configured(self) -> bool:
        return bool(self.sis_ak and self.sis_sk and self.sis_project_id)

    @property
    def websocket_endpoint(self) -> str:
        endpoint = self.sis_endpoint.rstrip("/")
        if endpoint.startswith(("ws://", "wss://")):
            return endpoint
        return f"wss://{endpoint}"

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            sis_ak=os.getenv("HUAWEICLOUD_SIS_AK", "").strip(),
            sis_sk=os.getenv("HUAWEICLOUD_SIS_SK", "").strip(),
            sis_project_id=os.getenv("HUAWEICLOUD_SIS_PROJECT_ID", "").strip(),
            sis_region=os.getenv("HUAWEICLOUD_SIS_REGION", "ap-southeast-3").strip(),
            sis_endpoint=os.getenv(
                "HUAWEICLOUD_SIS_ENDPOINT",
                "sis-ext.ap-southeast-3.myhuaweicloud.com",
            ).strip(),
            allowed_origins=_get_origins(),
            public_websocket_url=os.getenv("PUBLIC_WEBSOCKET_URL", "").strip(),
            session_ttl_seconds=_get_int("SESSION_TTL_SECONDS", 60),
            max_connections_per_ip=_get_int("MAX_CONNECTIONS_PER_IP", 2),
            max_session_seconds=_get_int("MAX_SESSION_SECONDS", 3600),
        )


def origin_is_allowed(settings: Settings, origin: str | None) -> bool:
    if not origin:
        return False
    return origin.rstrip("/") in settings.allowed_origins

