import { adminPool } from './admin-client.js';
import { getDatabaseAdminEnvironment, getDatabaseEnvironment } from './env.js';
import {
  APP_DATABASE_ROLE,
  buildSupabasePrivilegeStatements,
  quoteIdentifier,
  quoteLiteral,
} from './supabase-hardening-statements.js';
import {
  assertSameSupabaseProject,
  assertSupabaseAdminConnection,
  assertSupabaseRuntimeConnection,
  parseSupabaseConnection,
} from './supabase-safety.js';

async function hardenSupabase(): Promise<void> {
  const runtime = parseSupabaseConnection(getDatabaseEnvironment().databaseUrl, 'DATABASE_URL');
  const admin = parseSupabaseConnection(getDatabaseAdminEnvironment().databaseUrl, 'DATABASE_DIRECT_URL');
  assertSupabaseRuntimeConnection(runtime);
  assertSupabaseAdminConnection(admin);
  assertSameSupabaseProject(runtime, admin);

  const runtimePassword = decodeURIComponent(runtime.url.password);
  if (runtimePassword.length < 16) {
    throw new Error('The runtime database role password must contain at least 16 characters.');
  }

  const roleIdentifier = quoteIdentifier(APP_DATABASE_ROLE);
  const passwordLiteral = quoteLiteral(runtimePassword);
  const [databaseRow] = (await adminPool.query<{ database_name: string }>(
    'SELECT current_database() AS database_name',
  )).rows;
  if (!databaseRow?.database_name) throw new Error('Could not resolve the target database name.');

  await adminPool.query('BEGIN');
  try {
    const roleResult = await adminPool.query<{
      rolname: string;
      rolsuper: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
      rolreplication: boolean;
      rolbypassrls: boolean;
    }>(
      `SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
       FROM pg_roles WHERE rolname = $1`,
      [APP_DATABASE_ROLE],
    );
    const existingRole = roleResult.rows[0];
    if (!existingRole) {
      await adminPool.query(
        `CREATE ROLE ${roleIdentifier} LOGIN PASSWORD ${passwordLiteral} `
        + 'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      );
    } else {
      if (existingRole.rolsuper
        || existingRole.rolcreatedb
        || existingRole.rolcreaterole
        || existingRole.rolreplication
        || existingRole.rolbypassrls) {
        throw new Error('Existing edunets_app role has unsafe elevated attributes.');
      }
      await adminPool.query(`ALTER ROLE ${roleIdentifier} PASSWORD ${passwordLiteral}`);
    }

    for (const statement of buildSupabasePrivilegeStatements(databaseRow.database_name)) {
      await adminPool.query(statement);
    }

    await adminPool.query('COMMIT');
    await adminPool.query("NOTIFY pgrst, 'reload config'");
    console.log('✅ Supabase runtime role, grants, and Data API isolation configured.');
  } catch (error) {
    await adminPool.query('ROLLBACK');
    throw error;
  }
}

hardenSupabase()
  .then(() => adminPool.end())
  .catch(async (error: unknown) => {
    console.error('❌ Supabase hardening failed:', error instanceof Error ? error.message : 'Unknown error');
    await adminPool.end();
    process.exitCode = 1;
  });
