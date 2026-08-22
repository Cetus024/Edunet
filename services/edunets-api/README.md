# EduNets API

Independent Node.js API for EduNets authentication and per-user learning data. It uses Hono, Better Auth, Drizzle ORM, and PostgreSQL. Browser clients never receive the Neon connection string or password hashes.

## Configuration

The service loads the repository root `.env.local`, then `.env.api.local`. Values in `.env.api.local` override the corresponding file values; variables supplied by the shell or container take precedence over both. Copy this directory's `.env.example` to the repository root as `.env.api.local` and set:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Server-only Neon PostgreSQL connection string. |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters. Never expose it to Next.js. |
| `BETTER_AUTH_URL` | Public API origin, for example `http://localhost:8787`. |
| `CORS_ORIGINS` | Comma-separated exact frontend origins. Wildcards are rejected. |
| `HOST` / `PORT` | Bind address and port; defaults are `0.0.0.0:8787`. |

Initialize the database from the repository root before starting the API:

```powershell
npm run db:initialize
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
- `GET|POST /api/auth/*` — Better Auth email/password endpoints. In particular: `/sign-up/email`, `/sign-in/email`, `/get-session`, and `/sign-out`.

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

Signup accepts Better Auth's standard `{ name, email, password }` fields plus optional `signupReferralCode` (maximum 64 characters). The referral code is stored but deliberately omitted from auth and business responses.

An onboarding request is:

```json
{
  "role": "student",
  "schoolId": "admiralty-secondary-school",
  "subjectId": "amath",
  "topicId": "amath-trig",
  "familiarity": "some"
}
```

Registration onboarding does not request or accept a learning artifact. Cached older clients may still send legacy material metadata during the rollout, but the API ignores it and stores `learningSource: "none"`. The compatibility field `school` may be supplied instead of `schoolId`, but it must exactly match a catalog entry.

A quiz submission is:

```json
{
  "submissionId": "4b375843-c273-4e7d-bfe7-ac20dbdaf47d",
  "topicId": "amath-trig",
  "mode": "concept-check",
  "startedAt": "2026-07-31T06:30:00.000Z",
  "answers": [
    { "questionKey": "amath-trig:v1:q01", "answer": 1 },
    { "questionKey": "amath-trig:v1:q02", "answer": "adjacent" },
    { "questionKey": "amath-trig:v1:q03", "answer": 0 },
    { "questionKey": "amath-trig:v1:q04", "answer": "14.0" },
    { "questionKey": "amath-trig:v1:q05", "answer": 1 }
  ]
}
```

The server requires exactly the five versioned keys from the static question bank, re-grades every answer, computes Memory Score and Next Review itself, then updates progress in the same transaction. The POST response includes `nextReviewAt`, calculated from that attempt's persisted `submittedAt` and resulting score. Repeating the same globally unique `submissionId` returns the stored per-question grading and original result without increasing the attempt count.

Students and parents can create and read only their own real enquiry threads. Teachers and tutors can read and reply only to threads assigned to them. The recipient directory returns completed teacher/tutor profiles for the selected subject, preferring same-school matches and falling back to global subject matches; email addresses are never returned. New enquiry and reply bodies are limited to 4,000 characters and require a globally unique UUID `submissionId`. A retry returns the original stored result without duplicating the message.

The first teacher/tutor inbox request lazily creates three recipient-specific, clearly marked demo threads without creating fake auth users. Demo replies are normal persisted messages. Thread requesters include nullable `className`; it is `null` for real users until a future profile field captures class information.

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
docker run --rm -p 8787:8787 --env-file .env.api.local edunets-api
```

Use frontend and API hosts under the same production parent domain when possible. The default `SameSite=Lax` cookie works for localhost ports and same-site subdomains; a genuinely cross-site deployment needs an explicit secure-cookie design and browser acceptance testing.
