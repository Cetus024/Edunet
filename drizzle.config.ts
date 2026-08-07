import { defineConfig } from 'drizzle-kit';

import { EDUNETS_SCHEMA_NAME } from './database/constants';
import { loadDatabaseEnvironment } from './database/env';

loadDatabaseEnvironment();

// A deliberately unusable fallback lets schema-only generation run without
// credentials. Commands that connect to PostgreSQL must provide DATABASE_URL.
const databaseUrl = process.env.DATABASE_URL
  ?? 'postgresql://invalid:invalid@127.0.0.1:1/invalid';

export default defineConfig({
  dialect: 'postgresql',
  schema: './database/schema/index.ts',
  out: './database/migrations',
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
