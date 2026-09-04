# EduNets API

Independent Node.js API for EduNets authentication and per-user learning data. It uses Hono, Better Auth, Drizzle ORM, and Supabase PostgreSQL. Browser clients never receive database connection strings or OAuth secrets.

## Configuration

The service loads the repository root `.env.local`; variables supplied by the shell or container take precedence. Copy the repository root `.env.example` to `.env.local` and set:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase transaction-mode runtime URL using the `edunets_app` role. |
| `DATABASE_DIRECT_URL` | Supabase direct/session-mode admin URL for migration and bootstrap commands. |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters. Never expose it to Next.js. |
| `BETTER_AUTH_URL` | Public API origin, for example `http://localhost:8787`. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth web application credentials. |
| `CORS_ORIGINS` | Comma-separated exact frontend origins. Wildcards are rejected. |
| `WEB_APP_URL` | Public frontend origin used in Study Squad invitation links. |
| `RESEND_API_KEY` | Server-only Resend API key used to deliver transactional emails. |
| `SQUAD_INVITE_FROM_EMAIL` | Sender using a domain verified in Resend. |
| `AUTH_FROM_EMAIL` | Sender for password-reset emails using a domain verified in Resend. |
| `AZURE_VISION_ENDPOINT` / `AZURE_VISION_KEY` | Server-only Azure AI Vision resource used for handwritten-note OCR. |
| `AZURE_FOUNDRY_ENDPOINT` / `AZURE_FOUNDRY_API_KEY` / `AZURE_FOUNDRY_MODEL` | Preferred Microsoft Foundry endpoint, key, and model deployment used for summaries and evaluation. |
| `MODELARTS_ENDPOINT` / `MODELARTS_API_KEY` / `MODELARTS_MODEL` | Optional later fallback analysis provider when the Foundry variables are absent. |
| `HOST` / `PORT` | Bind address and port; defaults are `0.0.0.0:8787`. |

Initialize and harden a new Supabase database from the repository root before starting the API:

```powershell
npm run db:setup:supabase
```

## Local development

The root development command starts both Next.js and this service:

```powershell
npm run dev
```

The API can also run independently:

```powershell
npm run dev:api
```

Useful checks are `npm run api:build` and `npm run api:test` from the repository root. The server binds to `http://localhost:8787` by default.

## HTTP contract

Public endpoints:

- `GET /health` — process liveness.
- `GET /ready` — PostgreSQL readiness; returns `503` while unavailable.
- `GET /api/v1/catalog` — fixed schools plus nested subjects, topics, and aliases.
- `GET|POST /api/auth/*` — Better Auth Google OAuth, email/password registration and login, password reset, session, and sign-out endpoints.

Authenticated endpoints require the Better Auth HttpOnly cookie and browser requests must use `credentials: "include"`:

- `GET /api/v1/me`
- `PUT /api/v1/me/onboarding`
- `GET /api/v1/me/study-state`
- `GET /api/v1/me/quiz-options?subjectId=biology&topicId=biology-ecology`
- `POST /api/v1/me/quiz-sets`
- `POST /api/v1/me/quiz-attempts`
- `GET /api/v1/me/quiz-attempts?topicId=amath-trig&limit=20`
- `GET /api/v1/me/question-recipients?subjectId=amath`
- `GET|POST /api/v1/me/enquiries`
- `POST /api/v1/me/enquiries/:threadId/messages`
- `PUT /api/v1/me/enquiries/:threadId/read`
- `POST /api/v1/me/onboarding/placement-set`
- `GET|POST /api/v1/me/study-squad`
- `GET /api/v1/me/school-directory`
- `POST /api/v1/me/study-squad/invitations/in-app`
- `POST /api/v1/me/study-squad/invitations/:invitationId/accept`
- `POST /api/v1/me/study-squad/invitations/:invitationId/decline`
- `POST /api/v1/me/study-squad/streak/restore`
- `POST /api/v1/me/squad-quiz-rooms`
- `GET /api/v1/me/squad-quiz-rooms/:roomId`
- `POST /api/v1/me/squad-quiz-rooms/:roomId/join`
- `POST /api/v1/me/squad-quiz-rooms/:roomId/heartbeat`
- `POST /api/v1/me/squad-quiz-rooms/:roomId/answers`
- `POST /api/v1/me/squad-quiz-rooms/:roomId/advance`
- `POST /api/v1/me/squad-quiz-rooms/:roomId/restart`
- `POST /api/v1/me/squad-quiz-rooms/:roomId/invitations`
- `POST /api/v1/me/study-squad/invitations` — optional email invitation flow.
- `GET /api/v1/study-squad-invitations/:token`
- `POST /api/v1/study-squad-invitations/:token/accept`
- `GET /api/v1/me/notifications`
- `PUT /api/v1/me/notifications/:notificationId/read`
- `PUT /api/v1/me/notifications/read-all`
- `POST /api/v1/me/capture/ocr` — extracts handwritten text with Azure AI Vision.
- `POST /api/v1/me/capture/summarize` — summarizes combined OCR and typed notes.
- `POST /api/v1/me/capture/evaluate` — summarizes first, then evaluates that summary against stored topic data.

Google signup can carry an optional referral code (maximum 64 characters) through signed OAuth state; email/password signup sends the same field in its protected request body. The server validates both paths before first-user creation. The referral code is stored but deliberately omitted from auth and business responses.

Configure Google's authorized redirect URIs as `http://localhost:8787/api/auth/callback/google` for local development and `${BETTER_AUTH_URL}/api/auth/callback/google` in production. Only Google accounts with a verified email are accepted. Google and credential accounts are never linked implicitly, even when their email addresses match; users must continue with their original sign-in method.

Email/password accounts use passwords from 8 to 128 characters and are signed in immediately after registration without email verification. Password-reset links expire after one hour, can be used once, and revoke existing sessions. Reset requests always return the same public response for unknown, Google-only, and password-account email addresses; only an existing credential account receives mail.

Student onboarding first requests a placement set with a UUID, subject, and topic. The response contains exactly ten MCQs and deliberately omits correct answers and explanations. The same UUID and all ten answers are then submitted atomically with onboarding:

```json
{
  "role": "student",
  "schoolId": "admiralty-secondary-school",
  "subjectId": "amath",
  "topicId": "amath-trig",
  "placement": {
    "submissionId": "4b375843-c273-4e7d-bfe7-ac20dbdaf47d",
    "startedAt": "2026-08-24T10:00:00.000Z",
    "answers": [
      { "questionKey": "amath-trig:v1:q01", "answer": 1 }
    ]
  }
}
```

The example abbreviates the answers array; the API requires the exact ten keys issued for the set. It grades on the server, stores the placement attempt and answers, creates the first topic progress row, and completes onboarding in one transaction. Teacher onboarding instead requires `role`, `schoolId`, and one or more named `teachingScopes`. Only Student and Teacher roles are accepted.

A Phase 1 assessment starts with:

```json
{
  "submissionId": "4b375843-c273-4e7d-bfe7-ac20dbdaf47d",
  "topicId": "amath-trig",
  "mode": "mcq"
}
```

`mcq` sessions contain 10 questions and `essay` sessions contain five 10-mark questions. Answers are posted one at a time for immediate feedback; Essay answers include a student-entered `marksObtained` value from 0–10 with at most two decimal places. Finishing publishes the assessment-only posterior with `P(T)=0`. The idempotent `feedback-complete` endpoint applies `P(T)=0.20` once, recomputes the separate mode Memory and the averaged Concept Memory, and saves one combined reminder. Starting a newer assessment for the same topic closes any older pending correction opportunity.

Students can create and read only their own real enquiry threads. Teachers can read and reply only to threads assigned to them. The recipient directory returns completed Teacher profiles for the selected subject, preferring same-school matches and falling back to global subject matches; email addresses are never returned. New enquiry and reply bodies are limited to 4,000 characters and require a globally unique UUID `submissionId`. A retry returns the original stored result without duplicating the message.

Study Squad membership, invitations, school-directory results, member Memory Scores, daily streaks, and monthly streak restores are database-backed. A squad day qualifies when at least one current member completes an MCQ or Essay after joining. Dates use Singapore time; the current day remains open until midnight. A shared pool of five restores per calendar month can repair the most recent break, with concurrent requests serialized and every restore attributed to a member. The directory is limited to completed Student and Teacher profiles at the signed-in user's school and never exposes email addresses. Only Students can create or join squads; only a squad owner can invite an available Student. In-app invitations do not depend on an email provider or custom domain. Enquiry activity, Study Squad invitation outcomes, and restores create persisted, recipient-specific notifications with safe internal links.

Live Squad Rescue quizzes persist their room, selected question keys, participants, presence heartbeat, one answer per participant per round, server-graded scores, round transitions, restarts, and immutable completion records. Only members of the room's Study Squad can read or join it, and only the host can invite more members or restart a finished room. Clients poll the authoritative room projection every two seconds and send a heartbeat every ten seconds; the API derives online/away presence without exposing correct answers before the signed-in participant submits. A completed run counts as qualifying Group Streak activity.

The first Teacher inbox request lazily creates three recipient-specific, clearly marked demo threads without creating fake auth users. Demo replies are normal persisted messages. Thread requesters include nullable `className`; it is `null` for real users until a future profile field captures class information.

All service-generated failures use:

```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Request validation failed.",
    "requestId": "..."
  }
}
```

SQL details, credentials, password hashes, cookies, and request bodies are never placed in responses or structured request logs.

## Docker

The build requires the repository root as its context because the service intentionally shares the database schema and existing static question bank:

```powershell
docker build -f services/edunets-api/Dockerfile -t edunets-api .
docker run --rm -p 8787:8787 --env-file .env.local edunets-api
```

Use frontend and API hosts under the same production parent domain when possible. The default `SameSite=Lax` cookie works for localhost ports and same-site subdomains; a genuinely cross-site deployment needs an explicit secure-cookie design and browser acceptance testing.
