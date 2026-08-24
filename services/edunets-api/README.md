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
- `GET|POST /api/auth/*` — Better Auth Google OAuth, session, and sign-out endpoints. Email/password registration and login are disabled.

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

Google signup can carry an optional referral code (maximum 64 characters) through signed OAuth state; the server validates it again before first-user creation. The referral code is stored but deliberately omitted from auth and business responses.

Configure Google's authorized redirect URIs as `http://localhost:8787/api/auth/callback/google` for local development and `${BETTER_AUTH_URL}/api/auth/callback/google` in production. Only Google accounts with a verified email are accepted; different-email implicit linking remains disabled.

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

Students can create and read only their own real enquiry threads. Teachers can read and reply only to threads assigned to them. The recipient directory returns completed Teacher profiles for the selected subject, preferring same-school matches and falling back to global subject matches; email addresses are never returned. New enquiry and reply bodies are limited to 4,000 characters and require a globally unique UUID `submissionId`. A retry returns the original stored result without duplicating the message.

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
