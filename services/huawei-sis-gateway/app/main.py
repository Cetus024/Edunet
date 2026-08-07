from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict

from .session_registry import InvalidSessionToken, SessionLimitReached, SessionRegistry
from .settings import Settings, origin_is_allowed
from .sis_bridge import GatewayEmitter, HuaweiSisBridge, SisBridge

logger = logging.getLogger("edunets.gateway")


class SessionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    language: Literal["en"] = "en"


class SessionResponse(BaseModel):
    token: str
    websocketUrl: str
    expiresAt: str


BridgeFactory = Callable[[Settings, GatewayEmitter], SisBridge]


def _client_ip(connection: Request | WebSocket) -> str:
    return connection.client.host if connection.client else "unknown"


def _websocket_url(request: Request, settings: Settings) -> str:
    if settings.public_websocket_url:
        base_url = settings.public_websocket_url.rstrip("/")
        if base_url.endswith("/ws/transcriptions"):
            return base_url
        return f"{base_url}/ws/transcriptions"

    scheme = "wss" if request.url.scheme == "https" else "ws"
    return f"{scheme}://{request.headers['host']}/ws/transcriptions"


async def _send_error(
    websocket: WebSocket,
    code: str,
    message: str,
    close_code: int = 1011,
) -> None:
    try:
        await websocket.send_json({"type": "error", "code": code, "message": message})
        await websocket.close(code=close_code)
    except RuntimeError:
        pass


def create_app(
    settings: Settings | None = None,
    bridge_factory: BridgeFactory = HuaweiSisBridge,
) -> FastAPI:
    app_settings = settings or Settings.from_env()
    sessions = SessionRegistry(
        ttl_seconds=app_settings.session_ttl_seconds,
        max_connections_per_ip=app_settings.max_connections_per_ip,
    )

    app = FastAPI(title="EduNets Huawei SIS Gateway", version="1.0.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(app_settings.allowed_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    @app.get("/health")
    async def health() -> dict[str, Any]:
        return {
            "status": "ok",
            "sisConfigured": app_settings.sis_configured,
            "region": app_settings.sis_region,
        }

    @app.post("/sessions", response_model=SessionResponse)
    async def create_session(payload: SessionRequest, request: Request) -> SessionResponse:
        del payload
        if not app_settings.sis_configured:
            raise HTTPException(
                status_code=503,
                detail={
                    "code": "SIS_NOT_CONFIGURED",
                    "message": "Huawei SIS credentials are not configured on the gateway.",
                },
            )

        origin = request.headers.get("origin")
        if not origin_is_allowed(app_settings, origin):
            raise HTTPException(
                status_code=403,
                detail={"code": "ORIGIN_NOT_ALLOWED", "message": "Origin is not allowed."},
            )

        grant = await sessions.create(_client_ip(request), origin.rstrip("/"))
        expires_at = datetime.fromtimestamp(grant.expires_at, tz=timezone.utc).isoformat()
        return SessionResponse(
            token=grant.token,
            websocketUrl=_websocket_url(request, app_settings),
            expiresAt=expires_at,
        )

    @app.websocket("/ws/transcriptions")
    async def transcriptions(websocket: WebSocket, token: str = "") -> None:
        await websocket.accept()
        client_ip = _client_ip(websocket)
        origin = websocket.headers.get("origin")
        if not origin_is_allowed(app_settings, origin):
            await _send_error(websocket, "ORIGIN_NOT_ALLOWED", "Origin is not allowed.", 4403)
            return

        acquired = False
        try:
            await sessions.consume(token, client_ip, origin.rstrip("/"))
            acquired = True
        except InvalidSessionToken:
            await _send_error(
                websocket,
                "INVALID_SESSION_TOKEN",
                "The transcription session token is invalid, expired, or already used.",
                4401,
            )
            return
        except SessionLimitReached:
            await _send_error(
                websocket,
                "SESSION_LIMIT_REACHED",
                "Too many active transcription sessions from this address.",
                4429,
            )
            return

        bridge: SisBridge | None = None
        started = False
        stopped = False
        send_lock = asyncio.Lock()

        async def emit(message: dict[str, str]) -> None:
            async with send_lock:
                try:
                    await websocket.send_json(message)
                except RuntimeError:
                    pass

        async def run_session() -> None:
            nonlocal bridge, started, stopped
            while True:
                incoming = await websocket.receive()
                if incoming["type"] == "websocket.disconnect":
                    raise WebSocketDisconnect(incoming.get("code", 1000))

                text = incoming.get("text")
                audio = incoming.get("bytes")

                if text is not None:
                    try:
                        command = json.loads(text)
                    except json.JSONDecodeError:
                        await _send_error(websocket, "INVALID_MESSAGE", "Client message must be JSON.", 4400)
                        return

                    if not isinstance(command, dict):
                        await _send_error(websocket, "INVALID_MESSAGE", "Client message must be an object.", 4400)
                        return

                    message_type = command.get("type")
                    if message_type == "start" and not started:
                        if command.get("language", "en") != "en":
                            await _send_error(
                                websocket,
                                "UNSUPPORTED_LANGUAGE",
                                "Only English transcription is supported.",
                                4400,
                            )
                            return
                        bridge = bridge_factory(app_settings, emit)
                        await asyncio.wait_for(bridge.start(), timeout=15)
                        started = True
                        await emit({"type": "ready"})
                        continue

                    if message_type == "stop" and started and not stopped:
                        stopped = True
                        assert bridge is not None
                        await asyncio.wait_for(bridge.stop(), timeout=25)
                        await emit({"type": "ended"})
                        await websocket.close(code=1000)
                        return

                    await _send_error(
                        websocket,
                        "INVALID_STATE",
                        "The message is not valid for the current transcription state.",
                        4400,
                    )
                    return

                if audio is not None:
                    if not started or bridge is None:
                        await _send_error(
                            websocket,
                            "SESSION_NOT_READY",
                            "Wait for the ready message before sending audio.",
                            4400,
                        )
                        return
                    if len(audio) != 3200:
                        await _send_error(
                            websocket,
                            "INVALID_AUDIO_CHUNK",
                            "PCM audio chunks must contain exactly 3200 bytes.",
                            4400,
                        )
                        return
                    await bridge.send_audio(audio)

        try:
            async with asyncio.timeout(app_settings.max_session_seconds):
                await run_session()
        except WebSocketDisconnect:
            pass
        except TimeoutError:
            await _send_error(
                websocket,
                "SESSION_TIMEOUT",
                "The maximum transcription session duration was reached.",
                1000,
            )
        except Exception:
            logger.exception("Huawei SIS gateway session failed client_ip=%s", client_ip)
            await _send_error(
                websocket,
                "TRANSCRIPTION_FAILED",
                "The Huawei SIS transcription session failed.",
            )
        finally:
            if bridge is not None:
                if started and not stopped:
                    try:
                        await asyncio.wait_for(bridge.stop(), timeout=5)
                    except Exception:
                        logger.warning("Could not end Huawei SIS session cleanly", exc_info=True)
                try:
                    await asyncio.wait_for(bridge.close(), timeout=5)
                except Exception:
                    logger.warning("Could not close Huawei SIS session cleanly", exc_info=True)
            if acquired:
                await sessions.release(client_ip)

    return app


app = create_app()

