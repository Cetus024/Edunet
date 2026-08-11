import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getDatabaseEnvironment } from './env.js';
import * as schema from './schema/index.js';

// HUAWEI CLOUD INTEGRATION POINT — RDS for PostgreSQL.
// This pool talks to plain wire-protocol PostgreSQL via `pg` + Drizzle, so
// it is already Huawei-RDS-compatible: swap `DATABASE_URL` (see
// database/env.ts) for a Huawei Cloud RDS for PostgreSQL instance's
// connection string and nothing else here needs to change. No vendor SDK,
// no proprietary client - the entire schema/query layer is standard SQL.
const environment = getDatabaseEnvironment();

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
