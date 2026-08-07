from __future__ import annotations

from collections.abc import Awaitable, Callable

from fastapi.testclient import TestClient

from app.main import create_app
from app.settings import Settings
from app.sis_bridge import extract_transcripts

ORIGIN = "http://localhost:3000"


def configured_settings(**overrides: object) -> Settings:
    values: dict[str, object] = {
        "sis_ak": "test-ak",
        "sis_sk": "test-sk",
        "sis_project_id": "test-project",
        "allowed_origins": (ORIGIN,),
        "session_ttl_seconds": 60,
        "max_connections_per_ip": 2,
        "max_session_seconds": 3600,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


class FakeSisBridge:
    instances: list["FakeSisBridge"] = []

    def __init__(
        self,
        settings: Settings,
        emit: Callable[[dict[str, str]], Awaitable[None]],
    ) -> None:
        del settings
        self.emit = emit
        self.audio: list[bytes] = []
        self.started = False
        self.stopped = False
        self.closed = False
        type(self).instances.append(self)

    async def start(self) -> None:
        self.started = True

    async def send_audio(self, audio: bytes) -> None:
        self.audio.append(audio)
        await self.emit({"type": "partial", "text": "interim words"})
        await self.emit({"type": "final", "text": "Final words."})

    async def stop(self) -> None:
        self.stopped = True

    async def close(self) -> None:
        self.closed = True


class FailingSisBridge(FakeSisBridge):
    async def start(self) -> None:
        raise RuntimeError("test SIS failure")


def create_session(client: TestClient) -> dict[str, str]:
    response = client.post(
        "/sessions",
        headers={"origin": ORIGIN},
        json={"language": "en"},
    )
    assert response.status_code == 200
    return response.json()


def test_health_and_unconfigured_session_error() -> None:
    client = TestClient(create_app(Settings(allowed_origins=(ORIGIN,))))

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {
        "status": "ok",
        "sisConfigured": False,
        "region": "ap-southeast-3",
    }

    session = client.post(
        "/sessions",
        headers={"origin": ORIGIN},
        json={"language": "en"},
    )
    assert session.status_code == 503
    assert session.json()["detail"]["code"] == "SIS_NOT_CONFIGURED"


def test_origin_is_restricted() -> None:
    client = TestClient(create_app(configured_settings()))
    response = client.post(
        "/sessions",
        headers={"origin": "https://untrusted.example"},
        json={"language": "en"},
    )
    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "ORIGIN_NOT_ALLOWED"


def test_audio_forwarding_results_stop_cleanup_and_one_time_token() -> None:
    FakeSisBridge.instances.clear()
    client = TestClient(create_app(configured_settings(), FakeSisBridge))
    session = create_session(client)
    websocket_path = f"/ws/transcriptions?token={session['token']}"

    with client.websocket_connect(websocket_path, headers={"origin": ORIGIN}) as websocket:
        websocket.send_json({"type": "start", "language": "en"})
        assert websocket.receive_json() == {"type": "ready"}

        audio = b"\x00\x01" * 1600
        websocket.send_bytes(audio)
        assert websocket.receive_json() == {"type": "partial", "text": "interim words"}
        assert websocket.receive_json() == {"type": "final", "text": "Final words."}

        websocket.send_json({"type": "stop"})
        assert websocket.receive_json() == {"type": "ended"}

    bridge = FakeSisBridge.instances[-1]
    assert bridge.audio == [audio]
    assert bridge.started is True
    assert bridge.stopped is True
    assert bridge.closed is True

    with client.websocket_connect(websocket_path, headers={"origin": ORIGIN}) as websocket:
        error = websocket.receive_json()
        assert error["type"] == "error"
        assert error["code"] == "INVALID_SESSION_TOKEN"


def test_invalid_audio_chunk_is_rejected_and_cleaned_up() -> None:
    FakeSisBridge.instances.clear()
    client = TestClient(create_app(configured_settings(), FakeSisBridge))
    session = create_session(client)

    with client.websocket_connect(
        f"/ws/transcriptions?token={session['token']}",
        headers={"origin": ORIGIN},
    ) as websocket:
        websocket.send_json({"type": "start", "language": "en"})
        assert websocket.receive_json() == {"type": "ready"}
        websocket.send_bytes(b"too short")
        error = websocket.receive_json()
        assert error["code"] == "INVALID_AUDIO_CHUNK"

    bridge = FakeSisBridge.instances[-1]
    assert bridge.audio == []
    assert bridge.stopped is True
    assert bridge.closed is True


def test_sis_start_error_is_not_replaced_with_fake_results() -> None:
    FailingSisBridge.instances.clear()
    client = TestClient(create_app(configured_settings(), FailingSisBridge))
    session = create_session(client)

    with client.websocket_connect(
        f"/ws/transcriptions?token={session['token']}",
        headers={"origin": ORIGIN},
    ) as websocket:
        websocket.send_json({"type": "start", "language": "en"})
        error = websocket.receive_json()
        assert error["type"] == "error"
        assert error["code"] == "TRANSCRIPTION_FAILED"

    bridge = FailingSisBridge.instances[-1]
    assert bridge.closed is True


def test_maximum_session_duration_returns_timeout_and_cleans_up() -> None:
    FakeSisBridge.instances.clear()
    client = TestClient(
        create_app(configured_settings(max_session_seconds=1), FakeSisBridge)
    )
    session = create_session(client)

    with client.websocket_connect(
        f"/ws/transcriptions?token={session['token']}",
        headers={"origin": ORIGIN},
    ) as websocket:
        websocket.send_json({"type": "start", "language": "en"})
        assert websocket.receive_json() == {"type": "ready"}
        error = websocket.receive_json()
        assert error["code"] == "SESSION_TIMEOUT"

    bridge = FakeSisBridge.instances[-1]
    assert bridge.stopped is True
    assert bridge.closed is True


def test_huawei_result_mapping_supports_partial_and_final_segments() -> None:
    response = {
        "trace_id": "trace-123",
        "segments": [
            {"start_time": 0, "end_time": 120, "is_final": False, "result": {"text": "hello"}},
            {"start_time": 0, "end_time": 500, "is_final": True, "result": {"text": "Hello world."}},
        ],
    }

    assert extract_transcripts(response) == [
        ("hello", False, (0, 120, "hello")),
        ("Hello world.", True, (0, 500, "Hello world.")),
    ]
