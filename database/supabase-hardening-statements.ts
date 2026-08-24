import { EDUNETS_SCHEMA_NAME } from './constants.js';

export const APP_DATABASE_ROLE = 'edunets_app';
export const PRIVATE_POSTGREST_SCHEMA = 'pgrst_no_exposed_schemas';

export function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

export function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

export function buildSupabasePrivilegeStatements(databaseName: string): string[] {
  const role = quoteIdentifier(APP_DATABASE_ROLE);
  const database = quoteIdentifier(databaseName);
  const schema = quoteIdentifier(EDUNETS_SCHEMA_NAME);
  const postgrestSchema = quoteIdentifier(PRIVATE_POSTGREST_SCHEMA);
  const applicationSchemas = `public, ${schema}`;

  return [
    `CREATE SCHEMA IF NOT EXISTS ${postgrestSchema}`,
    `REVOKE ALL ON SCHEMA ${postgrestSchema} FROM PUBLIC`,
    'REVOKE USAGE ON SCHEMA public FROM PUBLIC',
    'REVOKE CREATE ON SCHEMA public FROM PUBLIC',
    `REVOKE ALL ON SCHEMA ${schema} FROM PUBLIC`,
    `REVOKE USAGE ON SCHEMA ${applicationSchemas} FROM anon, authenticated`,
    'REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated',
    `REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${schema} FROM anon, authenticated`,
    'REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated',
    `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA ${schema} FROM anon, authenticated`,
    'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated',
    `REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} FROM anon, authenticated`,
    'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC',
    `REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA ${schema} FROM PUBLIC`,
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated',
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ${schema} REVOKE ALL ON TABLES FROM anon, authenticated`,
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated',
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ${schema} REVOKE ALL ON SEQUENCES FROM anon, authenticated`,
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated',
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ${schema} REVOKE ALL ON FUNCTIONS FROM anon, authenticated`,
    'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC',
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ${schema} REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC`,
    `GRANT CONNECT ON DATABASE ${database} TO ${role}`,
    `GRANT USAGE ON SCHEMA ${applicationSchemas} TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO ${role}`,
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
    `GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA ${schema} TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ${schema} GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${role}`,
    `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA ${schema} GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${role}`,
    `REVOKE ALL ON TABLE ${schema}.__drizzle_migrations FROM ${role}`,
    `REVOKE ALL ON TABLE ${schema}.schema_metadata FROM ${role}`,
  ];
}
