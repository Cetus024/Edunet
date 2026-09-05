# Capture Hub 2.0 — Development Handoff

Updated: 5 September 2026 (Singapore time)

## Current status

The Capture Hub 2.0 base implementation is merged into `main` and pushed to GitHub. The working tree currently contains an uncommitted accessible note-reading entry plus this updated handoff.

- Repository: `C:\Users\ASUS\Edunet`
- Current branch: `main`
- Current commit: `d80a9fb` (`feat: expose capture analysis diagnostics`)
- `main`, `origin/main`, `capture-hub-2.0`, and `origin/capture-hub-2.0` point to the same commit.
- Local `.codex-tmp/` and `artifacts/` directories are unrelated untracked document artifacts and must not be committed with Capture Hub.

## Product flow

Capture Hub is phone-first for O-Level students:

1. Upload a photo of handwritten notes for Azure AI Vision OCR, or type/paste notes.
2. Show the raw OCR transcript separately.
3. Combine OCR and typed notes into an editable transcript so the student can correct recognition mistakes.
4. Send the corrected notes to Microsoft Foundry for a concise summary.
5. Compare that generated summary with the selected topic's backend syllabus grounding.
6. Return the evaluation percentage, correct points, incorrect points, missing points, and feedback.
7. Open a material through the visible `Read note` action to read its full OCR/typed transcript with its original line breaks.

Voice recording and voice translation are intentionally not part of this flow.

The reading entry is visible on every material card and is also available in the card menu. It is keyboard accessible and works on touch devices without relying on a hover-only menu. Demo materials do not contain original transcript data, so their reader states that honestly; newly processed materials display their captured text.

Current limitation: the materials library is still component state, so newly processed materials do not survive a full page refresh. Account-level persistence is a separate backend/database task.

## Diagnostics and failure handling

- The raw OCR transcript is visible even when later analysis fails.
- An in-page debug log records input, OCR, summary, grounding, evaluation, and connection stages.
- Toasts distinguish missing configuration, provider connection errors/timeouts, empty OCR or summary output, missing syllabus grounding, and invalid evaluation output.
- API responses expose safe reason codes without leaking credentials or upstream response bodies.

## Azure resources

Both resources are in resource group `EdunetTesting` under the Azure for Students subscription.

### OCR

- Resource: `edunet-capturehub-vision-wesly`
- Service: Azure AI Vision
- Region: Japan East
- Tier: Free F0
- Endpoint: `https://edunet-capturehub-vision-wesly.cognitiveservices.azure.com/`
- API: Image Analysis `2024-02-01`, feature `read`
- Live OCR test passed and recognized the expected synthetic test text.

### Summary and evaluation

- Resource: `edunet-capturehub-foundry-wesly`
- Service: Azure OpenAI / Microsoft Foundry
- Resource region: Japan East
- Endpoint: `https://edunet-capturehub-foundry-wesly.openai.azure.com/`
- Deployment name: `gpt-4.1-mini`
- Model/version: `gpt-4.1-mini`, `2025-04-14`
- Deployment SKU: `GlobalStandard`
- Capacity configured: `1`
- Live `/openai/v1/chat/completions` test passed with HTTP 200.
- A second test through the application's real `azure-foundry.ts` adapter also passed.

`GlobalStandard` can process requests outside Japan East. Do not describe this deployment as single-region data residency.

## Secrets and environment

The repository-root `.env.local` is configured locally and ignored by Git. It contains:

- `AZURE_VISION_ENDPOINT`
- `AZURE_VISION_KEY`
- `AZURE_FOUNDRY_ENDPOINT`
- `AZURE_FOUNDRY_API_KEY`
- `AZURE_FOUNDRY_MODEL=gpt-4.1-mini`

Never commit `.env.local`, print its values in logs, or move these keys to a `NEXT_PUBLIC_` variable. A new machine or hosted environment must receive the same values through its own secret manager/environment configuration.

Huawei ModelArts remains an environment-variable fallback. Microsoft Foundry is selected first whenever all `AZURE_FOUNDRY_*` values are present.

## Important quota limitation

The Azure for Students offer is limited to roughly 1,000 tokens per minute for this model deployment. The Foundry adapter currently sets `max_tokens: 900` for every request, and Azure includes `max_tokens` when estimating TPM usage.

A complete Capture Hub analysis makes two model calls: one summary call and one evaluation call. With the current settings, the second call can receive HTTP 429, especially for longer notes or when both calls run within the same minute.

Recommended next change:

1. Give summary and evaluation separate output limits instead of the shared 900-token limit.
2. Use approximately 250 output tokens for summary and 400 for evaluation.
3. Add bounded retry/backoff that respects Azure's `Retry-After` response.
4. Keep the existing toast/debug-log reporting when retries are exhausted.

OCR is on F0: the first 5,000 transactions per month are free, subject to the service's per-minute limit. One uploaded image normally consumes one OCR transaction. Foundry billing is based on actual input and generated output tokens, not the configured `max_tokens`; `max_tokens` mainly affects the rate-limit estimate.

## Main implementation files

- `features/capture-hub.tsx` — Capture Hub interface, transcript review, diagnostics, and toasts.
- `lib/api/capture.ts` — frontend API contracts.
- `services/edunets-api/src/env.ts` — loads the repository-root `.env.local` without overriding host-provided variables.
- `services/edunets-api/src/services/ocr.ts` — Azure Vision OCR adapter.
- `services/edunets-api/src/services/azure-foundry.ts` — Microsoft Foundry chat-completions adapter.
- `services/edunets-api/src/services/analysis-model.ts` — Foundry-first provider selection and ModelArts fallback.
- `services/edunets-api/src/services/summarize-notes.ts` — note summary prompt and parser.
- `services/edunets-api/src/services/note-evaluation.ts` — grounded evaluation prompt, parser, and score.
- `services/edunets-api/src/services/capture-analysis.ts` — summary-first evaluation orchestration.
- `services/edunets-api/src/routes/api-v1.ts` — OCR, summary, and evaluation route integration.

## Verification record

- Full repository TypeScript check passed.
- ESLint passed.
- Full API suite passed: 24 test files and 185 tests.
- Next.js and API production builds passed.
- Browser smoke test passed for the Capture Hub interface and typed-note flow.
- Azure Foundry targeted tests passed: 3 tests.
- API service TypeScript check passed again after Azure configuration.
- Live Azure Vision OCR connection passed.
- Live Foundry connection and the production adapter path both passed.

## Run locally

From `C:\Users\ASUS\Edunet`:

```powershell
npm run dev
```

- Web: `http://localhost:3000/capture-hub`
- API health: `http://localhost:8787/health`

Restart the dev processes after changing `.env.local`; an already-running process does not automatically reload environment variables.
