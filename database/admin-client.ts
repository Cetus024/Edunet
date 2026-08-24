import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { getDatabaseAdminEnvironment } from './env.js';
import * as schema from './schema/index.js';
import { assertSupabaseAdminConnection, parseSupabaseConnection } from './supabase-safety.js';

const environment = getDatabaseAdminEnvironment();
assertSupabaseAdminConnection(parseSupabaseConnection(
  environment.databaseUrl,
  'DATABASE_DIRECT_URL',
));

export const adminPool = new Pool({
  connectionString: environment.databaseUrl,
  max: environment.poolMax,
  idleTimeoutMillis: environment.poolIdleTimeoutMillis,
  connectionTimeoutMillis: environment.poolConnectionTimeoutMillis,
  application_name: 'edunets-database-admin',
});

adminPool.on('error', () => {
  console.error('Unexpected idle administrative PostgreSQL connection error.');
});

export const adminDb = drizzle(adminPool, { schema });
