import { defineConfig } from 'drizzle-kit';

import './packages/database/env';
import { EDUNETS_SCHEMA_NAME } from './packages/database/constants';

// A deliberately unusable fallback lets schema-only generation run without
// credentials. Commands that connect to PostgreSQL must provide
// DATABASE_DIRECT_URL.
const databaseUrl = process.env.DATABASE_DIRECT_URL
  ?? 'postgresql://invalid:invalid@127.0.0.1:1/invalid';

export default defineConfig({
  dialect: 'postgresql',
  schema: './packages/database/schema/index.ts',
  out: './packages/database/migrations',
  dbCredentials: { url: databaseUrl },
  schemaFilter: [EDUNETS_SCHEMA_NAME],
  migrations: {
    schema: EDUNETS_SCHEMA_NAME,
    table: '__drizzle_migrations',
  },
  breakpoints: true,
  strict: true,
  verbose: true,
});
