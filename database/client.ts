import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getDatabaseEnvironment } from './env.js';
import * as schema from './schema/index.js';
import { assertSupabaseRuntimeConnection, parseSupabaseConnection } from './supabase-safety.js';

// Runtime traffic uses Supabase's transaction-mode pooler through standard
// PostgreSQL wire protocol. Migrations use the separate admin client so DDL
// never runs through the serverless runtime connection.
const environment = getDatabaseEnvironment();
if (process.env.NODE_ENV !== 'test') {
  assertSupabaseRuntimeConnection(parseSupabaseConnection(environment.databaseUrl, 'DATABASE_URL'));
}

export const pool = new Pool({
  connectionString: environment.databaseUrl,
  max: environment.poolMax,
  idleTimeoutMillis: environment.poolIdleTimeoutMillis,
  connectionTimeoutMillis: environment.poolConnectionTimeoutMillis,
  application_name: 'edunets-api',
});

pool.on('error', () => {
  // Keep hostnames, addresses, connection configuration, and query details out
  // of logs; request middleware owns correlated operational error reporting.
  console.error('Unexpected idle PostgreSQL connection error.');
});

export const db = drizzle(pool, { schema });

/** Raw node-postgres connection pool for health checks and migration tooling. */
export const connection = pool;
