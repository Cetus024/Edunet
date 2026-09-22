# EduNets

EduNets is a Next.js + Hono learning platform for Singapore O-Level revision. The static frontend stays Power Apps-compatible; the API owns accounts, onboarding, progress, quizzes, and enquiries.

Start with [`CLAUDE.md`](CLAUDE.md). Verified changes go in [`docs/UPDATE_LOG.md`](docs/UPDATE_LOG.md).

## Technology

- Next.js 16 App Router and React 19 (`apps/web`)
- Hono, Better Auth, Drizzle ORM, Supabase PostgreSQL (`apps/api` + `packages/database`)
- TanStack Query, Jotai, Tailwind 4, Radix UI
- Azure AI Vision OCR + Microsoft Foundry (ModelArts fallback)
- Static export to `apps/web/out/` for Power Apps

## Commands

```bash
npm install
npm run db:setup:supabase
npm run dev
npm run check
npm run build
npm run api:start
```

`npm run dev` starts web on `:3000` and API on `:8787`. Build outputs: `apps/web/out/` and `apps/api/dist/`.

Copy `.env.example` to `.env.local` at the **repo root**. See [`packages/database/README.md`](packages/database/README.md) and [`apps/api/README.md`](apps/api/README.md).

## Structure

```text
edunets/
├─ apps/
│  ├─ web/                 Next.js frontend (features, components, lib/api)
│  └─ api/                 Hono + Better Auth API
├─ packages/
│  └─ database/            Drizzle schema, migrations, seed
├─ api/                    Vercel serverless adapter (mounts apps/api)
├─ docs/                   overview + UPDATE_LOG
├─ scripts/                run-web, preview, env checks
├─ app-gen-sdk/            Power Apps / Dataverse generated client
├─ generated/              Generated data contracts
├─ services/
│  └─ huawei-sis-gateway/  Optional speech gateway
├─ power.config.json       Power Apps → apps/web/out
└─ package.json            Root scripts + shared dependencies
```

## Routes

| Route | Feature |
| --- | --- |
| `/` | Public presentation |
| `/dashboard` | Student dashboard or Teacher overview |
| `/quiz` | Smart Quiz / Teacher review |
| `/concept-web` | Concept web |
| `/capture-hub` | Note capture (OCR → summarize → evaluate) |
| `/profile` | Profile |
| `/study-squad` | Study squad |
| `/ask-teacher` | Enquiries |
| `/login` `/signup` `/onboarding` | Auth + setup |
| `/placement-result` | Placement quiz result |

## Power Apps

`power.config.json` points to `apps/web/out/index.html`. Keep `app-gen-sdk/` and `generated/` aligned with the target environment.
