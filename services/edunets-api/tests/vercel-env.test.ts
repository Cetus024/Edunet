import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptPath = fileURLToPath(new URL('../../../scripts/check-vercel-env.mjs', import.meta.url));
const productionOrigin = 'https://edunet-two.vercel.app';
const validEnvironment = {
  ...process.env,
  VERCEL_ENV: 'production',
  DATABASE_URL: 'postgresql://edunets_app.project-ref:do-not-print@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  BETTER_AUTH_SECRET: 'a-secure-test-value-that-is-longer-than-thirty-two-characters',
  BETTER_AUTH_URL: productionOrigin,
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'do-not-print-google-secret',
  CORS_ORIGINS: productionOrigin,
  NEXT_PUBLIC_EDUNETS_API_URL: productionOrigin,
  WEB_APP_URL: productionOrigin,
};

describe('Vercel production environment preflight', () => {
  it('accepts the production origin and Supabase transaction pooler', () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: validEnvironment,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Production environment preflight passed.');
    expect(result.stderr).toBe('');
  });

  it('reports only invalid variable names', () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      env: {
        ...validEnvironment,
        DATABASE_URL: 'do-not-print-invalid-database-url',
        BETTER_AUTH_SECRET: 'do-not-print-short-secret',
        BETTER_AUTH_URL: 'http://localhost:8787',
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('BETTER_AUTH_SECRET');
    expect(result.stderr).toContain('BETTER_AUTH_URL');
    expect(result.stderr).toContain('DATABASE_URL');
    expect(result.stderr).not.toContain('do-not-print');
  });
});
