# EduNets

EduNets is a Next.js application for Singapore O-Level revision. It keeps the existing Power Apps-compatible static frontend while using a separate Node API for real accounts, onboarding, per-user learning progress, server-graded quiz history, and student-to-teacher enquiries.

## Technology

- Next.js 16 App Router and React 19
- TypeScript 5 with strict type checking
- Tailwind CSS 4 and Radix UI
- TanStack Query and Jotai
- Hono, Better Auth, Drizzle ORM, and Supabase PostgreSQL
- Browser-native English transcription with an optional Huawei Cloud SIS gateway
- Microsoft Power Apps code app SDK and generated Dataverse client
- Static export to `out/` for Power Apps deployment

## Commands

```bash
npm install
npm run db:setup:supabase
npm run dev
npm run check
npm run build
npm run api:start
```

`npm run dev` starts the web frontend at `http://localhost:3000` and the API at `http://localhost:8787`. `npm run build` creates the deployable static frontend in `out/` and the API bundle in `services/edunets-api/dist/`. Use `npm start` to preview the static frontend and `npm run api:start` for its API.

Copy `.env.example` to the ignored `.env.local` and replace every placeholder. PostgreSQL, Better Auth, and Google credentials are server-only; only `NEXT_PUBLIC_EDUNETS_API_URL` is exposed to the browser. Database setup is idempotent and uses separate Supabase runtime and administrative connections. See [`database/README.md`](database/README.md) and [`services/edunets-api/README.md`](services/edunets-api/README.md).

Capture Hub live transcription defaults to the browser's English speech recognizer in supported Chrome and Edge browsers; this mode does not require a separate gateway. Set `NEXT_PUBLIC_TRANSCRIPTION_PROVIDER=huawei` and configure `NEXT_PUBLIC_HUAWEI_SIS_GATEWAY_URL` to use the optional Huawei SIS gateway instead. Huawei AK/SK credentials and the Project ID must only be configured in the Python service documented at [`services/huawei-sis-gateway`](services/huawei-sis-gateway/README.md); they must never be added to the Next.js environment. The frontend keeps final transcript text in the existing capture flow and does not persist raw microphone audio.

## Structure

```text
edunets/
├─ src/
│  ├─ app/            Next.js routes, layouts, and providers
│  ├─ features/       Existing business screens
│  ├─ components/     Shared application and UI components
│  ├─ hooks/          Application hooks
│  ├─ lib/            Business data, state, and compatibility helpers
│  └─ generated/      Generated data contracts
├─ app-gen-sdk/       Generated Power Apps/Dataverse client
├─ data-model/        Dataverse model metadata
├─ database/          Drizzle schema, migrations, catalog seed, and guarded lifecycle scripts
├─ docs/              Product documentation
├─ public/            Static assets
├─ scripts/           Local static-export preview tooling
├─ services/
│  ├─ edunets-api/    Hono + Better Auth API
│  └─ huawei-sis-gateway/ Optional Huawei speech gateway
├─ next.config.ts     Next.js static-export configuration
├─ power.config.json  Power Apps code app configuration
└─ package.json       Node.js scripts and dependencies
```

The routing adapter in `src/lib/navigation.tsx` preserves the screens' existing navigation API while delegating routing to the Next.js App Router. Power Apps is initialized lazily in the browser so static generation does not execute browser-only SDK code.

## Routes

| Route | Existing feature |
| --- | --- |
| `/` | Public EduNets presentation and product introduction |
| `/dashboard` | Student dashboard or Teacher class overview |
| `/quiz` | Student quiz or Teacher demonstration review |
| `/concept-web` | Student concept web or Teacher demonstration class view |
| `/capture-hub` | Note and question capture |
| `/profile` | Student profile |
| `/study-squad` | Collaborative study squad |
| `/ask-teacher` | Student question flow or Teacher Students' Enquiries workspace |
| `/rescue-room` | Rescue room |
| `/rescue-join` | Rescue room join flow |
| `/login` | Google login |
| `/signup` | Google account creation with an optional referral code |
| `/onboarding` | Required first-account setup |
| `/placement-result` | Student starting-point quiz result and answer review |

EduNets supports Student and Teacher accounts. New Students complete a database-backed, ten-question topic placement quiz during onboarding; Teachers configure one or more teaching subjects and classrooms without taking the quiz. Enquiries are persisted in Supabase PostgreSQL and scoped to the authenticated Student and assigned Teacher.

## Power Apps deployment

`power.config.json` points Power Apps to `out/index.html`. Keep the generated contents of `app-gen-sdk/`, `src/generated/`, `.power/`, and the Dataverse identifiers in `power.config.json` aligned with the target Power Platform environment. Browser/localhost authentication is the current validated target; embedded Power Apps cookie behaviour requires a later production-domain acceptance pass.
