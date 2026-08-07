from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, Protocol

from .settings import Settings

logger = logging.getLogger("edunets.sis")

GatewayEmitter = Callable[[dict[str, str]], Awaitable[None]]


class SisBridge(Protocol):
    async def start(self) -> None: ...

    async def send_audio(self, audio: bytes) -> None: ...

    async def stop(self) -> None: ...

    async def close(self) -> None: ...


def _is_final(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() == "true"


def extract_transcripts(message: dict[str, Any]) -> list[tuple[str, bool, tuple[Any, ...]]]:
    """Map Huawei RESULT payloads without exposing the raw response to the browser."""
    raw_segments = message.get("segments")
    segments = raw_segments if isinstance(raw_segments, list) else [message]
    transcripts: list[tuple[str, bool, tuple[Any, ...]]] = []

    for segment in segments:
        if not isinstance(segment, dict):
            continue
        result = segment.get("result")
        result_object = result if isinstance(result, dict) else {}
        text = result_object.get("text") or segment.get("text")
        if not isinstance(text, str) or not text.strip():
            continue
        final = _is_final(segment.get("is_final", result_object.get("is_final", False)))
        signature = (
            segment.get("start_time", result_object.get("start_time")),
            segment.get("end_time", result_object.get("end_time")),
            text.strip(),
        )
        transcripts.append((text.strip(), final, signature))

    return transcripts


class HuaweiSisBridge:
    def __init__(self, settings: Settings, emit: GatewayEmitter) -> None:
        self._settings = settings
        self._emit = emit
        self._loop: asyncio.AbstractEventLoop | None = None
        self._client: Any = None
        self._audio_queue: asyncio.Queue[bytes | None] = asyncio.Queue()
        self._audio_worker: asyncio.Task[None] | None = None
        self._worker_error: Exception | None = None
        self._callback_error: str | None = None
        self._final_segments: set[tuple[Any, ...]] = set()
        self._closed = False
        self._stopped = False
        self.trace_id: str | None = None

    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._audio_worker = asyncio.create_task(self._send_audio_worker())
        await asyncio.to_thread(self._connect_and_start)
        if self._callback_error:
            raise RuntimeError(self._callback_error)

    def _connect_and_start(self) -> None:
        from huaweicloud_sis.bean.callback import RasrCallBack
        from huaweicloud_sis.bean.rasr_request import RasrRequest
        from huaweicloud_sis.bean.sis_config import SisConfig
        from huaweicloud_sis.client.rasr_client import RasrClient

        bridge = self

        class Callback(RasrCallBack):
            def on_start(self, message: str) -> None:
                bridge._set_trace_id(str(message).removeprefix("trace id is "))

            def on_response(self, message: dict[str, Any]) -> None:
                bridge._handle_response(message)

            def on_end(self, message: str) -> None:
                bridge._set_trace_id(str(message).removeprefix("trace id is "))

            def on_error(self, error: Any) -> None:
                bridge._callback_error = str(error)
                bridge._schedule_emit(
                    {
                        "type": "error",
                        "code": "HUAWEI_SIS_ERROR",
                        "message": "Huawei SIS could not complete the transcription.",
                    }
                )

        config = SisConfig()
        config.set_connect_timeout(10)
        config.set_read_timeout(10)
        config.set_connect_lost_timeout(10)
        config.set_certificate_check(True)

        request = RasrRequest("pcm16k16bit", "english_16k_general")
        request.set_add_punc("yes")
        request.set_interim_results("yes")
        request.set_max_seconds(30)
        request.set_need_word_info("no")

        self._client = RasrClient(
            ak=self._settings.sis_ak,
            sk=self._settings.sis_sk,
            use_aksk=True,
            region=self._settings.sis_region,
            project_id=self._settings.sis_project_id,
            callback=Callback(),
            config=config,
            service_endpoint=self._settings.websocket_endpoint,
        )
        self._client.continue_stream_connect(request)
        self._client.send_start()

    def _set_trace_id(self, trace_id: str) -> None:
        clean_trace_id = trace_id.strip()
        if not clean_trace_id:
            return
        self.trace_id = clean_trace_id
        logger.info("Huawei SIS trace_id=%s", clean_trace_id)

    def _handle_response(self, message: dict[str, Any]) -> None:
        trace_id = message.get("trace_id")
        if trace_id:
            self._set_trace_id(str(trace_id))

        for text, final, signature in extract_transcripts(message):
            if final:
                if signature in self._final_segments:
                    continue
                self._final_segments.add(signature)
            self._schedule_emit({"type": "final" if final else "partial", "text": text})

    def _schedule_emit(self, message: dict[str, str]) -> None:
        if self._loop is None or self._loop.is_closed():
            return
        future = asyncio.run_coroutine_threadsafe(self._emit(message), self._loop)
        future.add_done_callback(lambda completed: completed.exception() if not completed.cancelled() else None)

    async def send_audio(self, audio: bytes) -> None:
        if self._closed or self._stopped:
            raise RuntimeError("Huawei SIS session is not accepting audio.")
        if self._worker_error:
            raise RuntimeError("Huawei SIS audio forwarding failed.") from self._worker_error
        await self._audio_queue.put(audio)

    async def _send_audio_worker(self) -> None:
        while True:
            audio = await self._audio_queue.get()
            try:
                if audio is None:
                    return
                await asyncio.to_thread(self._client.send_audio, audio, len(audio), 0)
            except Exception as error:
                self._worker_error = error
                await self._emit(
                    {
                        "type": "error",
                        "code": "HUAWEI_SIS_AUDIO_ERROR",
                        "message": "Audio could not be forwarded to Huawei SIS.",
                    }
                )
            finally:
                self._audio_queue.task_done()

    async def stop(self) -> None:
        if self._stopped:
            return
        self._stopped = True
        await self._audio_queue.join()
        if self._worker_error:
            raise RuntimeError("Huawei SIS audio forwarding failed.") from self._worker_error
        if self._client is not None:
            await asyncio.to_thread(self._client.send_end)
        await self._stop_worker()

    async def _stop_worker(self) -> None:
        worker = self._audio_worker
        if worker is None:
            return
        if not worker.done():
            await self._audio_queue.put(None)
            await worker
        self._audio_worker = None

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self._stop_worker()
        client = self._client
        self._client = None
        if client is not None:
            await asyncio.to_thread(client.close)

