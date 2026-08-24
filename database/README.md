# EduNets database on Supabase

EduNets uses Supabase only as managed PostgreSQL. Authentication remains in Better Auth and every browser request goes through the Hono API; the frontend does not use Supabase Auth, PostgREST, or a Supabase service-role key.

## Connections

- `DATABASE_URL` is the runtime connection. Use the `edunets_app` database role with Supavisor transaction mode on port `6543`.
- `DATABASE_DIRECT_URL` is the administrative connection. Use the `postgres` role with the direct endpoint or Supavisor session mode on port `5432`.
- Keep both values server-only. Copy `.env.example` to the ignored `.env.local` and replace every placeholder.

The runtime and administrative URLs must point to the same Supabase project. `db:harden:supabase` validates the hosts and project reference before changing roles or privileges.

## First setup

Start with a Supabase project that has no EduNets application tables, then run:

```powershell
npm run db:setup:supabase
```

The command performs three guarded, repeatable stages:

1. Create the marked `edunets` schema and apply committed Drizzle migrations with `DATABASE_DIRECT_URL`.
2. Reconcile the fixed catalog and verify exactly 151 schools, 8 subjects, 51 topics, and 255 questions.
3. Create/update the least-privilege `edunets_app` role and remove `anon`/`authenticated` access to application schemas, tables, sequences, and functions.

Run the same command again to verify migration and seed idempotency. The ownership guard refuses to initialize an existing foreign schema or a marker with the wrong value.

## Supabase project settings

Disable the Data API in the Supabase dashboard. Supabase protects the platform-owned `authenticator` role from SQL changes by project database administrators, so that dashboard switch cannot be automated with `DATABASE_DIRECT_URL`. The hardening command still revokes application access from `anon` and `authenticated` as defense in depth. Do not add `NEXT_PUBLIC_SUPABASE_ACCESS_TOKEN`, a service-role key, or a database password to frontend variables.

Google configuration is documented in `services/edunets-api/README.md`.
