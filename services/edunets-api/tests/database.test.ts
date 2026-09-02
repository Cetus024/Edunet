import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
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
    expect(quizQuestionSeed).toHaveLength(816);
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
      expect(['practice', 'placement', 'both']).toContain(question.usage);
      if (question.type === 'mcq') {
        const options = JSON.parse(question.options ?? 'null') as unknown;
        expect(Array.isArray(options), question.id).toBe(true);
        expect(Number.isInteger(Number(question.correctAnswer)), question.id).toBe(true);
        expect(Number(question.correctAnswer), question.id).toBeGreaterThanOrEqual(0);
        expect(Number(question.correctAnswer), question.id).toBeLessThan((options as unknown[]).length);
      }
    }
  });

  it('provides ten MCQs and five ten-mark Essay questions per topic', () => {
    for (const topic of topicSeed) {
      const rows = quizQuestionSeed.filter((question) => question.topicId === topic.id);
      const placement = rows.filter((question) => question.type === 'mcq'
        && (question.usage === 'placement' || question.usage === 'both'));
      const practice = rows.filter((question) => question.usage === 'practice' || question.usage === 'both');
      const essays = rows.filter((question) => question.type === 'structured');
      expect(placement, topic.id).toHaveLength(10);
      expect(practice, topic.id).toHaveLength(9);
      expect(essays, topic.id).toHaveLength(5);
      expect(essays.every((question) => question.maxMarks === 10), topic.id).toBe(true);
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

describe('student and teacher role migration', () => {
  it('deletes removed-role data before installing restrictive checks', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0009_violet_shinobi_shaw.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');
    const deleteUsersAt = migration.indexOf('DELETE FROM "user"');
    const roleCheckAt = migration.indexOf('ADD CONSTRAINT "profile_role_check"');

    expect(migration).toContain("WHERE \"role\" IN ('parent', 'tutor')");
    expect(migration).toContain('DELETE FROM "edunets"."enquiry_threads"');
    expect(migration).toContain('DELETE FROM "question_review"');
    expect(deleteUsersAt).toBeGreaterThanOrEqual(0);
    expect(roleCheckAt).toBeGreaterThan(deleteUsersAt);
    expect(migration).toContain("CHECK (\"profile\".\"role\" in ('student', 'teacher'))");
  });
});

describe('Phase 1 dual-memory migration', () => {
  it('clears only old learning evidence and installs dual-mode progress', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0011_phase1_dual_memory.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('DELETE FROM "user_topic_progress"');
    expect(migration).toContain('DELETE FROM "quiz_attempt"');
    expect(migration).toContain('CREATE TABLE "user_topic_mode_progress"');
    expect(migration).toContain("'phase1-v1'");
    expect(migration).toContain('quiz_attempt_one_active_topic_idx');
    expect(migration).not.toContain('DELETE FROM "user"');
    expect(migration).not.toContain('DELETE FROM "subjects"');
    expect(migration).not.toContain('DELETE FROM "topics"');
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
