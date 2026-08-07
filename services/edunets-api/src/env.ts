import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parse as parseDotenv } from 'dotenv';
import { z } from 'zod';

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
 * Load repository-local configuration without allowing dotenv files to replace
 * values explicitly supplied by the shell or container runtime.
 */
export function loadEnvironmentFiles(startDirectory = process.cwd()): void {
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

const rawEnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  BETTER_AUTH_SECRET: z.string().min(32, 'BETTER_AUTH_SECRET must contain at least 32 characters'),
  BETTER_AUTH_URL: z.url().default('http://localhost:8787'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  HOST: z.string().min(1).default('0.0.0.0'),
});

function parseOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin === '*') throw new Error('CORS_ORIGINS must not contain a wildcard');
      const url = new URL(origin);
      if (url.origin !== origin || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        throw new Error(`CORS origin must be an exact HTTP(S) origin: ${origin}`);
      }
      return url.origin;
    });

  if (origins.length === 0) throw new Error('CORS_ORIGINS must contain at least one origin');
  return [...new Set(origins)];
}

const rawEnvironment = rawEnvironmentSchema.parse(process.env);
const betterAuthUrl = new URL(rawEnvironment.BETTER_AUTH_URL);
if (rawEnvironment.NODE_ENV === 'production'
  && betterAuthUrl.protocol !== 'https:'
  && !['localhost', '127.0.0.1', '::1'].includes(betterAuthUrl.hostname)) {
  throw new Error('BETTER_AUTH_URL must use HTTPS in production (except localhost).');
}

export const env = Object.freeze({
  nodeEnv: rawEnvironment.NODE_ENV,
  databaseUrl: rawEnvironment.DATABASE_URL,
  betterAuthSecret: rawEnvironment.BETTER_AUTH_SECRET,
  betterAuthUrl: betterAuthUrl.origin,
  corsOrigins: parseOrigins(rawEnvironment.CORS_ORIGINS),
  port: rawEnvironment.PORT,
  host: rawEnvironment.HOST,
  isProduction: rawEnvironment.NODE_ENV === 'production',
});
