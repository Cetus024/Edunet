import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { adminDb, adminPool } from './admin-client.js';
import { EDUNETS_SCHEMA_NAME } from './constants.js';
import { assertSchemaCanBeInitialized, ensureOwnershipMarker } from './schema-safety.js';

async function createDatabase(): Promise<void> {
  await assertSchemaCanBeInitialized(adminPool);
  await adminPool.query(`CREATE SCHEMA IF NOT EXISTS "${EDUNETS_SCHEMA_NAME}"`);
  await ensureOwnershipMarker(adminPool);

  await migrate(adminDb, {
    migrationsFolder: './database/migrations',
    migrationsTable: '__drizzle_migrations',
    migrationsSchema: EDUNETS_SCHEMA_NAME,
  });

  console.log('✅ Migrations applied.');
}

createDatabase()
  .then(() => adminPool.end())
  .catch(async (error: unknown) => {
    console.error('❌ Migration failed:', error);
    await adminPool.end();
    process.exitCode = 1;
  });
