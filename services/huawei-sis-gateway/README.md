# EduNets Huawei Cloud SIS Gateway

This service keeps Huawei Cloud credentials on the server and forwards browser PCM audio to Huawei SIS real-time speech recognition. It does not store or log audio or transcript text.

## Fixed recognition configuration

- Region: `ap-southeast-3` (AP-Singapore)
- SIS endpoint: `sis-ext.ap-southeast-3.myhuaweicloud.com`
- API mode: `continue_stream`
- Audio: mono PCM, 16 kHz, signed 16-bit little-endian
- Browser chunk size: 3,200 bytes (100 ms)
- Model: `english_16k_general`
- Punctuation and interim results: enabled
- Huawei sentence limit: 30 seconds

## Local development

Use Python 3.11 or newer. Copy `.env.example` into your own secret environment configuration, then set `HUAWEICLOUD_SIS_AK`, `HUAWEICLOUD_SIS_SK`, and `HUAWEICLOUD_SIS_PROJECT_ID`. Do not commit that file.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
Copy-Item .env.example .env
# Fill in the three Huawei credential values in .env, then start the service:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --env-file .env
```

At the repository root, set the frontend variable and restart Next.js:

```text
NEXT_PUBLIC_HUAWEI_SIS_GATEWAY_URL=http://localhost:8000
```

Without Huawei credentials, `GET /health` remains available and reports `sisConfigured: false`; `POST /sessions` returns `503 SIS_NOT_CONFIGURED`. There is intentionally no fake transcription fallback.

## Browser protocol

- `GET /health` reports readiness without returning credentials.
- `POST /sessions` with `{ "language": "en" }` creates a one-time token valid for 60 seconds.
- Connect to the returned WebSocket URL with the token query parameter.
- Send `{ "type": "start", "language": "en" }`, wait for `ready`, then send 3,200-byte PCM chunks.
- Send `{ "type": "stop" }` to flush Huawei SIS and receive `ended`.
- Recognition messages are `partial` or `final`; only final text should be persisted by the client.

## AP-Singapore deployment

1. Build the container from this directory and publish it to Huawei Cloud SWR.
2. Run it on an AP-Singapore ECS or CCE workload. Inject AK, SK, and Project ID as secret environment variables.
3. Put the service behind an HTTPS load balancer or API gateway that supports WebSocket upgrades. Set `PUBLIC_WEBSOCKET_URL` to its public `wss://` address.
4. Set `ALLOWED_ORIGINS` to the exact production EduNets origins and keep the per-IP and one-hour limits enabled.
5. Set `NEXT_PUBLIC_HUAWEI_SIS_GATEWAY_URL` to the public `https://` base URL before building the Next.js static export.

Run tests with `pytest`. The test suite injects a fake SIS bridge and never calls Huawei Cloud.
