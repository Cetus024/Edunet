export function getDatabaseEnvironment() {
  const databaseUrl = process.env.DATABASE_URL ?? '';
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return {
    databaseUrl,
    poolMax: Number(process.env.DATABASE_POOL_MAX ?? 10),
    poolIdleTimeoutMillis: Number(process.env.DATABASE_POOL_IDLE_TIMEOUT_MILLIS ?? 30000),
    poolConnectionTimeoutMillis: Number(process.env.DATABASE_POOL_CONNECTION_TIMEOUT_MILLIS ?? 10000), // Increased from 2000 to 10000
  } as const;
}
