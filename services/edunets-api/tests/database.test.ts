import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { assertDatabaseDeletionAllowed } from '../../../database/deleteDB.js';
import { assertSchemaCanBeInitialized, ensureOwnershipMarker } from '../../../database/schema-safety.js';
import { buildSupabasePrivilegeStatements } from '../../../database/supabase-hardening-statements.js';
import {
  assertSameSupabaseProject,
  assertSupabaseAdminConnection,
  assertSupabaseRuntimeConnection,
  parseSupabaseConnection,
} from '../../../database/supabase-safety.js';
import {
  quizQuestionSeed,
  schoolSeed,
  subjectSeed,
  topicSeed,
} from '../../../database/seed-data.js';

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

describe('database catalog seed', () => {
  it('contains the exact fixed catalog counts', () => {
    expect(schoolSeed).toHaveLength(151);
    expect(subjectSeed).toHaveLength(8);
    expect(topicSeed).toHaveLength(51);
    expect(quizQuestionSeed).toHaveLength(255);
  });

  it('uses unique school, subject, and topic IDs', () => {
    expectUnique(schoolSeed.map((school) => school.id));
    expectUnique(subjectSeed.map((subject) => subject.id));
    expectUnique(topicSeed.map((topic) => topic.id));
  });

  it('assigns every topic to an existing subject', () => {
    const subjectIds = new Set(subjectSeed.map((subject) => subject.id));

    for (const topic of topicSeed) {
      expect(subjectIds.has(topic.subjectId), topic.id).toBe(true);
    }
  });

  it('contains valid, uniquely keyed question fixture rows', () => {
    const topicIds = new Set(topicSeed.map((topic) => topic.id));
    expectUnique(quizQuestionSeed.map((question) => question.id));

    for (const question of quizQuestionSeed) {
      expect(topicIds.has(question.topicId), question.id).toBe(true);
      expect(question.id).toMatch(new RegExp(`^${question.topicId}-q\\d{3}$`));
      if (question.type === 'mcq') {
        const options = JSON.parse(question.options ?? 'null') as unknown;
        expect(Array.isArray(options), question.id).toBe(true);
        expect(Number.isInteger(Number(question.correctAnswer)), question.id).toBe(true);
        expect(Number(question.correctAnswer), question.id).toBeGreaterThanOrEqual(0);
        expect(Number(question.correctAnswer), question.id).toBeLessThan((options as unknown[]).length);
      }
    }
  });
});

describe('database deletion guard', () => {
  const confirmation = '--confirm=DROP_EDUNETS_SCHEMA';

  it('refuses deletion in production even with all other conditions', () => {
    expect(() => assertDatabaseDeletionAllowed({
      nodeEnv: 'production',
      allowDatabaseReset: 'true',
      arguments: [confirmation],
    })).toThrow('Database reset is disabled in production.');
  });

  it('refuses deletion without the explicit environment opt-in', () => {
    expect(() => assertDatabaseDeletionAllowed({
      nodeEnv: 'development',
      allowDatabaseReset: undefined,
      arguments: [confirmation],
    })).toThrow('Database reset requires ALLOW_DATABASE_RESET=true.');
  });

  it('refuses deletion without the exact confirmation argument', () => {
    expect(() => assertDatabaseDeletionAllowed({
      nodeEnv: 'development',
      allowDatabaseReset: 'true',
      arguments: [],
    })).toThrow('Database reset requires --confirm=DROP_EDUNETS_SCHEMA.');
  });

  it('accepts the complete non-production guard conditions', () => {
    expect(() => assertDatabaseDeletionAllowed({
      nodeEnv: 'development',
      allowDatabaseReset: 'true',
      arguments: [confirmation],
    })).not.toThrow();
  });
});

describe('database schema ownership guard', () => {
  it('creates the marker table and owner value during first bootstrap', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ value: 'edunets' }] });
    await ensureOwnershipMarker({ query });

    expect(String(query.mock.calls[0]?.[0])).toContain('CREATE TABLE IF NOT EXISTS "edunets".schema_metadata');
    expect(String(query.mock.calls[1]?.[0])).toContain("VALUES ('owner', 'edunets')");
    expect(String(query.mock.calls[1]?.[0])).toContain('ON CONFLICT (key) DO NOTHING');
    expect(String(query.mock.calls[2]?.[0])).toContain('SELECT value');
  });

  it('does not silently overwrite an ownership marker conflict', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ value: 'another-app' }] });

    await expect(ensureOwnershipMarker({ query }))
      .rejects.toThrow('Could not verify the edunets schema ownership marker');
  });

  it('counts non-relation schema objects before accepting an unmarked schema', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ marker_table: null }] })
      .mockResolvedValueOnce({ rows: [{ object_count: 1 }] });

    await expect(assertSchemaCanBeInitialized({ query } as unknown as Pool))
      .rejects.toThrow('has no valid EduNets ownership marker');

    const objectCountQuery = String(query.mock.calls[2]?.[0]);
    expect(objectCountQuery).toContain('pg_catalog.pg_class');
    expect(objectCountQuery).toContain('pg_catalog.pg_type');
    expect(objectCountQuery).toContain('pg_catalog.pg_proc');
    expect(objectCountQuery).toContain('pg_catalog.pg_extension');
  });

  it('accepts a schema with the exact EduNets ownership marker', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ marker_table: 'edunets.schema_metadata' }] })
      .mockResolvedValueOnce({ rows: [{ value: 'edunets' }] });

    await expect(assertSchemaCanBeInitialized({ query } as unknown as Pool)).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('rejects a marker table with the wrong ownership value', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ marker_table: 'edunets.schema_metadata' }] })
      .mockResolvedValueOnce({ rows: [{ value: 'another-app' }] });

    await expect(assertSchemaCanBeInitialized({ query } as unknown as Pool))
      .rejects.toThrow('invalid ownership marker');
  });
});

describe('Supabase connection safety', () => {
  it('extracts roles and the same project from direct and pooler URLs', () => {
    const runtime = parseSupabaseConnection(
      'postgresql://edunets_app.projectref:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
      'DATABASE_URL',
    );
    const admin = parseSupabaseConnection(
      'postgresql://postgres.projectref:password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
      'DATABASE_DIRECT_URL',
    );

    expect(runtime.databaseRole).toBe('edunets_app');
    expect(runtime.connectionMode).toBe('transaction');
    expect(admin.databaseRole).toBe('postgres');
    expect(admin.connectionMode).toBe('session');
    expect(() => assertSupabaseRuntimeConnection(runtime)).not.toThrow();
    expect(() => assertSupabaseAdminConnection(admin)).not.toThrow();
    expect(() => assertSameSupabaseProject(runtime, admin)).not.toThrow();
  });

  it('isolates application schemas from Data API roles and grants only runtime data access', () => {
    const statements = buildSupabasePrivilegeStatements('postgres').join('\n');

    expect(statements).not.toContain('ALTER ROLE authenticator');
    expect(statements).toContain('pgrst_no_exposed_schemas');
    expect(statements).toContain('REVOKE USAGE ON SCHEMA public, "edunets" FROM anon, authenticated');
    expect(statements).toContain('REVOKE USAGE ON SCHEMA public FROM PUBLIC');
    expect(statements).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated');
    expect(statements).toContain('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated');
    expect(statements).toContain('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC');
    expect(statements).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "edunets_app"');
    expect(statements).toContain('REVOKE ALL ON TABLE "edunets".__drizzle_migrations FROM "edunets_app"');
    expect(statements).toContain('REVOKE ALL ON TABLE "edunets".schema_metadata FROM "edunets_app"');
  });

  it('rejects foreign hosts and mismatched projects before hardening', () => {
    expect(() => parseSupabaseConnection(
      'postgresql://postgres:password@example.com:5432/postgres',
      'DATABASE_DIRECT_URL',
    )).toThrow('Supabase database host');

    const runtime = parseSupabaseConnection(
      'postgresql://edunets_app.first:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
      'DATABASE_URL',
    );
    const admin = parseSupabaseConnection(
      'postgresql://postgres.second:password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
      'DATABASE_DIRECT_URL',
    );
    expect(() => assertSameSupabaseProject(runtime, admin)).toThrow('same Supabase project');
  });

  it('rejects the wrong pooler modes and database roles', () => {
    const runtimeOnSessionPort = parseSupabaseConnection(
      'postgresql://edunets_app.projectref:password@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres',
      'DATABASE_URL',
    );
    expect(() => assertSupabaseRuntimeConnection(runtimeOnSessionPort)).toThrow('port 6543');

    const adminOnTransactionPort = parseSupabaseConnection(
      'postgresql://postgres.projectref:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
      'DATABASE_DIRECT_URL',
    );
    expect(() => assertSupabaseAdminConnection(adminOnTransactionPort)).toThrow('port 5432');

    const wrongRuntimeRole = parseSupabaseConnection(
      'postgresql://postgres.projectref:password@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres',
      'DATABASE_URL',
    );
    expect(() => assertSupabaseRuntimeConnection(wrongRuntimeRole)).toThrow('edunets_app');
  });
});
