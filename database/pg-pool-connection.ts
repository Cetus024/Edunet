import type { PoolConfig } from 'pg';

/**
 * pg treats sslmode=require as verify-full. Local Windows TLS inspection then
 * fails with SELF_SIGNED_CERT_IN_CHAIN. Drop the URL flag and skip certificate
 * verification outside production so login and ingest can reach Supabase.
 */
export function postgresPoolConnection(databaseUrl: string): Pick<PoolConfig, 'connectionString' | 'ssl'> {
  const verifyCertificates = process.env.NODE_ENV === 'production'
    && process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';
  if (verifyCertificates) {
    return { connectionString: databaseUrl };
  }

  const url = new URL(databaseUrl);
  url.searchParams.delete('sslmode');
  url.searchParams.delete('uselibpqcompat');
  return {
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  };
}
