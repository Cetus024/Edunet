import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseDotenv } from 'dotenv';

function findRepositoryRoot(startDirectory: string): string {
  let current = resolve(startDirectory);

  while (true) {
    if (existsSync(join(current, 'next.config.ts')) && existsSync(join(current, 'package.json'))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) return resolve(startDirectory);
    current = parent;
  }
}

/**
 * Loads repository-local configuration without letting dotenv files replace
 * values already supplied by the shell or container runtime. Idempotent and
 * safe to call from any script (local CLI tools, the API server, tests) -
 * whichever caller runs first wins, later calls are no-ops for already-set
 * keys.
 */
function loadEnvironmentFiles(startDirectory = process.cwd()): void {
  const repositoryRoot = findRepositoryRoot(startDirectory);
  const protectedKeys = new Set(Object.keys(process.env));

  for (const filename of ['.env.local', '.env.api.local']) {
    const path = join(repositoryRoot, filename);
    if (!existsSync(path)) continue;

    const values = parseDotenv(readFileSync(path));
    for (const [key, value] of Object.entries(values)) {
      if (!protectedKeys.has(key)) process.env[key] = value;
    }
  }
}

loadEnvironmentFiles();

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
