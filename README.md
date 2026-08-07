# EduNets

EduNets is a Next.js application for Singapore O-Level revision. It keeps the existing Power Apps-compatible static frontend while using a separate Node API for real accounts, onboarding, per-user learning progress, server-graded quiz history, and student-to-teacher enquiries.

## Technology

- Next.js 16 App Router and React 19
- TypeScript 5 with strict type checking
- Tailwind CSS 4 and Radix UI
- TanStack Query and Jotai
- Hono, Better Auth, Drizzle ORM, and Neon PostgreSQL
- Browser-native English transcription with an optional Huawei Cloud SIS gateway
- Microsoft Power Apps code app SDK and generated Dataverse client
- Static export to `out/` for Power Apps deployment

## Commands

```bash
npm install
npm run db:initialize
npm run dev
npm run check
npm run build
npm run api:start
```

`npm run dev` starts the web frontend at `http://localhost:3000` and the API at `http://localhost:8787`. `npm run build` creates the deployable static frontend in `out/` and the API bundle in `services/edunets-api/dist/`. Use `npm start` to preview the static frontend and `npm run api:start` for its API.

Copy the server values from `.env.example` into the ignored `.env.api.local`. `DATABASE_URL` and `BETTER_AUTH_SECRET` are server-only; only `NEXT_PUBLIC_EDUNETS_API_URL` is exposed to the browser. Database setup is idempotent and operates only inside the marked `edunets` PostgreSQL schema. See [`database/README.md`](database/README.md) and [`services/edunets-api/README.md`](services/edunets-api/README.md).

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
| `/dashboard` | Student/Parent dashboard; Teacher/Tutor accounts are redirected to enquiries |
| `/quiz` | Student quiz or role-based Teacher/Tutor demonstration review |
| `/concept-web` | Student concept web or role-based Teacher/Tutor demonstration class view |
| `/capture-hub` | Note and question capture |
| `/profile` | Student profile |
| `/study-squad` | Collaborative study squad |
| `/ask-teacher` | Student/Parent question flow or Teacher/Tutor Students' Enquiries workspace |
| `/rescue-room` | Rescue room |
| `/rescue-join` | Rescue room join flow |
| `/login` | Email/password login |
| `/signup` | Account creation |
| `/onboarding` | Required first-account setup |

Teacher and Tutor accounts use a dark three-page workspace containing Smart Quiz, Concept Web, and Students' Enquiries. The first two pages are explicitly marked demonstration views; enquiries are persisted in Neon, scoped to the authenticated participants, and include three clearly labelled demo threads for each Teacher/Tutor account.

## Power Apps deployment

`power.config.json` points Power Apps to `out/index.html`. Keep the generated contents of `app-gen-sdk/`, `src/generated/`, `.power/`, and the Dataverse identifiers in `power.config.json` aligned with the target Power Platform environment. Browser/localhost authentication is the current validated target; embedded Power Apps cookie behaviour requires a later production-domain acceptance pass.
