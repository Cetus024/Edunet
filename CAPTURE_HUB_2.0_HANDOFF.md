# Capture Hub 2.0 — Development Handoff

## Git state

- Repository: `C:\Users\ASUS\Edunet`
- Working branch: `capture-hub-2.0`
- The changes are intentionally uncommitted and have not been pushed.
- Do not include `.codex-tmp/` or `artifacts/` in the GitHub Desktop commit.

## Product direction

Capture Hub is designed for O-Level students who often use phones instead of laptops:

1. Capture handwritten notes through image upload and Microsoft Azure AI Vision OCR.
2. Combine the OCR result with notes typed or pasted by the student.
3. Let the student correct the combined text before processing.
4. Generate a concise O-Level-style summary.
5. Evaluate that summary against syllabus grounding stored by the backend.

Voice recording and voice translation have been removed from this flow.

## Diagnostics and transparency

- The raw Azure Vision OCR transcript is shown separately from the editable combined notes.
- A rolling in-page debug log records input, OCR, summary, grounding, evaluation, and connection stages.
- Toasts distinguish missing configuration, API disconnection, provider failure or timeout, empty OCR/summary output, missing syllabus grounding, and an invalid evaluation response.
- Diagnostic responses use safe reason codes and do not expose credentials or upstream response bodies.

## Microsoft integration

- OCR provider: Microsoft Azure AI Vision Image Analysis API `2024-02-01`.
- Summary and evaluation provider: Microsoft Foundry/OpenAI-compatible chat completions API.
- Azure Foundry is preferred when configured.
- Huawei ModelArts remains only as an environment-variable fallback for a later provider switch.
- No API keys or secrets are stored in this repository.

Required server configuration is documented in `.env.example`:

- `AZURE_VISION_ENDPOINT`
- `AZURE_VISION_KEY`
- `AZURE_FOUNDRY_ENDPOINT`
- `AZURE_FOUNDRY_API_KEY`
- `AZURE_FOUNDRY_MODEL`

## Azure provisioning status

The Azure Portal Computer Vision form was prepared with:

- Resource group: `EdunetTesting`
- Region: Japan East
- Resource name: `edunet-capturehub-vision-wesly`
- Pricing tier: Free F0

The resource has not been created yet. The account owner must personally review and acknowledge the Responsible AI notice before selecting Review + create.

## Main implementation files

- `features/capture-hub.tsx` — Capture Hub 2.0 user interface and combined-note workflow.
- `lib/api/capture.ts` — client API response contract for summary and evaluation.
- `services/edunets-api/src/services/azure-foundry.ts` — Azure Foundry model adapter.
- `services/edunets-api/src/services/analysis-model.ts` — provider selection with Foundry preference.
- `services/edunets-api/src/services/capture-analysis.ts` — summary-first evaluation pipeline.
- `services/edunets-api/src/services/ocr.ts` — Azure Vision OCR request.
- `services/edunets-api/src/routes/api-v1.ts` — API route integration.

## Verification completed

- TypeScript typecheck passed.
- ESLint passed for the changed files.
- API test suite passed: 23 test files and 174 tests.
- Production build passed for the Next.js application and API service.
- Browser smoke test passed: Capture Hub 2.0 rendered, voice capture was absent, typed notes entered the editable combined-note review area, and no framework error overlay or console error was detected.

## Suggested GitHub Desktop commit

Summary:

`feat: upgrade Capture Hub with Azure OCR and Foundry`

Before committing, leave `.codex-tmp/` and `artifacts/` unchecked in GitHub Desktop.
