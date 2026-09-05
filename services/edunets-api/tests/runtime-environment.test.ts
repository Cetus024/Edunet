import { describe, expect, it } from 'vitest';

import { findInvalidRuntimeVariables } from '../../../api/runtime-environment.js';

const validEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://edunets_app.project-ref:secret@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
  BETTER_AUTH_SECRET: 'a-secure-test-value-that-is-longer-than-thirty-two-characters',
  BETTER_AUTH_URL: 'https://edunet-two.vercel.app',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  CORS_ORIGINS: 'https://edunet-two.vercel.app',
};

describe('serverless runtime environment diagnostics', () => {
  it('accepts the production runtime contract', () => {
    expect(findInvalidRuntimeVariables(validEnvironment)).toEqual([]);
  });

  it('returns only the names of invalid variables', () => {
    expect(findInvalidRuntimeVariables({
      ...validEnvironment,
      DATABASE_URL: 'secret-invalid-value',
      BETTER_AUTH_SECRET: 'short',
      BETTER_AUTH_URL: 'http://localhost:8787',
    })).toEqual([
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_URL',
      'DATABASE_URL',
    ]);
  });
});
