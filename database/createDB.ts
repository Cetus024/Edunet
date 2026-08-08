import { migrate } from 'drizzle-orm/node-postgres/migrator';

import { EDUNETS_SCHEMA_NAME } from './constants.js';
import { db, pool } from './index.js';
import { assertSchemaCanBeInitialized } from './schema-safety.js';

async function createDatabase(): Promise<void> {
  await assertSchemaCanBeInitialized(pool);
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${EDUNETS_SCHEMA_NAME}"`);

  await migrate(db, {
    migrationsFolder: './database/migrations',
    migrationsTable: '__drizzle_migrations',
    migrationsSchema: EDUNETS_SCHEMA_NAME,
  });

  console.log('✅ Migrations applied.');
}

createDatabase()
  .then(() => pool.end())
  .catch(async (error: unknown) => {
    console.error('❌ Migration failed:', error);
    await pool.end();
    process.exitCode = 1;
  });
