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
  subtopicSeed,
  topicAliasSeed,
  topicSeed,
} from '../../../database/seed-data.js';
import { resolveCurriculumTopic } from '../../../lib/curriculum.js';

function expectUnique(values: readonly string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

describe('database catalog seed', () => {
  it('contains the exact fixed catalog counts', () => {
    expect(schoolSeed).toHaveLength(151);
    expect(subjectSeed).toHaveLength(2);
    expect(topicSeed).toHaveLength(15);
    expect(subtopicSeed).toHaveLength(41);
    expect(quizQuestionSeed).toHaveLength(225);
    expect(subjectSeed.map((subject) => subject.name)).toEqual(['Mathematics', 'Chemistry']);
  });

  it('uses unique school, subject, and topic IDs', () => {
    expectUnique(schoolSeed.map((school) => school.id));
    expectUnique(subjectSeed.map((subject) => subject.id));
    expectUnique(topicSeed.map((topic) => topic.id));
    expectUnique(subtopicSeed.map((subtopic) => subtopic.id));
    expectUnique(topicAliasSeed.map((alias) => alias.id));
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
      const placement = rows.filter((question) => question.type === 'mcq' && question.usage === 'both');
      const practice = rows.filter((question) => question.usage === 'practice' || question.usage === 'both');
      const essays = rows.filter((question) => question.type === 'structured');
      expect(placement, topic.id).toHaveLength(10);
      expect(practice, topic.id).toHaveLength(15);
      expect(essays, topic.id).toHaveLength(5);
      expect(essays.every((question) => question.maxMarks === 10), topic.id).toBe(true);
    }
  });

  it('keeps every question subtopic inside its parent and covers all formal subtopics with MCQs', () => {
    const subtopicById = new Map(subtopicSeed.map((subtopic) => [subtopic.id, subtopic]));
    const coveredByMcq = new Set<string>();
    for (const question of quizQuestionSeed) {
      if (question.subtopicId === null) continue;
      expect(subtopicById.get(question.subtopicId)?.topicId, question.id).toBe(question.topicId);
      if (question.type === 'mcq') coveredByMcq.add(question.subtopicId);
    }
    expect(coveredByMcq.size).toBe(41);
    expect(subtopicSeed.every((subtopic) => coveredByMcq.has(subtopic.id))).toBe(true);
    const unsplitTopicIds = new Set([
      'chemistry-qualitative-analysis',
      'chemistry-chemical-energetics',
      'chemistry-rate-reactions',
      'chemistry-maintaining-air-quality',
    ]);
    expect(quizQuestionSeed
      .filter((question) => unsplitTopicIds.has(question.topicId))
      .every((question) => question.subtopicId === null)).toBe(true);
  });

  it('resolves legacy Topic IDs and names to the new parent Topics', () => {
    expect(resolveCurriculumTopic('e-math-numbers')?.id).toBe('math-number-algebra');
    expect(resolveCurriculumTopic('Algebra')?.id).toBe('math-number-algebra');
    expect(resolveCurriculumTopic('e-math-geometry')?.id).toBe('math-geometry-measurement');
    expect(resolveCurriculumTopic('chemistry-stoichiometry')?.id).toBe('chemistry-chemical-calculations');
    expect(resolveCurriculumTopic('Acids & Bases')?.id).toBe('chemistry-acid-base-chemistry');
    expect(resolveCurriculumTopic('chemistry-rate-of-reaction')?.id).toBe('chemistry-rate-reactions');
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

describe('curriculum v2 migration', () => {
  const migration = readFileSync(fileURLToPath(new URL(
    '../../../database/migrations/0018_curriculum_v2.sql',
    import.meta.url,
  )), 'utf8');

  it('runs the first-time conversion only when curriculum v2 is absent', () => {
    const installedGuardAt = migration.indexOf("IF to_regclass('public.subtopics') IS NOT NULL THEN");
    const reconciledReturnAt = migration.indexOf('RETURN;', installedGuardAt);
    const destructiveCleanupAt = migration.indexOf('DELETE FROM "user_topic_mode_progress"');

    expect(installedGuardAt).toBeGreaterThanOrEqual(0);
    expect(reconciledReturnAt).toBeGreaterThan(installedGuardAt);
    expect(destructiveCleanupAt).toBeGreaterThan(reconciledReturnAt);
    expect(migration).toContain('without changing learning data');
  });

  it('rejects a partial former installation instead of rerunning cleanup', () => {
    expect(migration).toContain('installed_columns <> 7');
    expect(migration).toContain('installed_subtopic_columns <> 6');
    expect(migration).toContain('installed_constraints <> 5');
    expect(migration).toContain("to_regclass('public.subtopics_topic_syllabus_code_idx') IS NULL");
    expect(migration).toContain('curriculum-v2 partial installation detected');
  });

  it('cleans Topic-dependent evidence before deleting retired catalog rows', () => {
    const quizCleanupAt = migration.indexOf('DELETE FROM "quiz_attempt"');
    const onboardingCleanupAt = migration.indexOf('DELETE FROM "onboarding_profile"');
    const topicCleanupAt = migration.indexOf('DELETE FROM "topics"');
    const subjectCleanupAt = migration.indexOf('DELETE FROM "subjects"');
    expect(quizCleanupAt).toBeGreaterThanOrEqual(0);
    expect(onboardingCleanupAt).toBeGreaterThan(quizCleanupAt);
    expect(topicCleanupAt).toBeGreaterThan(onboardingCleanupAt);
    expect(subjectCleanupAt).toBeGreaterThan(topicCleanupAt);
    expect(migration).toContain('DELETE FROM "user_topic_mode_progress"');
    expect(migration).toContain('DELETE FROM "discussion_room"');
    expect(migration).toContain('DELETE FROM "edunets"."squad_quiz_rooms"');
    expect(migration).toMatch(/NOT EXISTS \(\s+SELECT 1 FROM "edunets"\."enquiry_threads"/);
  });

  it('preserves identity, school and Study Squad tables and resets learning onboarding', () => {
    expect(migration).not.toContain('DELETE FROM "user"');
    expect(migration).not.toContain('DELETE FROM "schools"');
    expect(migration).not.toContain('DELETE FROM "edunets"."study_squads"');
    expect(migration).not.toContain('DELETE FROM "edunets"."study_squad_members"');
    expect(migration).not.toContain('DELETE FROM "edunets"."study_squad_invitations"');
    expect(migration).toContain('WHERE "role" = \'student\'');
    expect(migration).toContain("AND p.\"role\" = 'student'");
    expect(migration).toContain('A teacher with at least one surviving scope remains onboarded');
    expect(migration).toContain('WHERE "subject_id" NOT IN (\'e-math\', \'chemistry\')');
    expect(migration).toContain('curriculum-v2 pre-migration counts');
  });

  it('installs exactly the canonical 15 Topic parents and remaps legacy enquiry links', () => {
    expect(migration).toContain("('e-math', 'Mathematics', '4052', '📐', 0)");
    expect(migration).toContain("('chemistry', 'Chemistry', '6092', '⚗️', 1)");
    expect(migration).toContain("('math-number-algebra', 'e-math', 'N', 'NUMBER AND ALGEBRA'");
    expect(migration).toContain("('chemistry-maintaining-air-quality', 'chemistry', '12', 'Maintaining Air Quality'");
    expect(migration).toContain("WHEN 'chemistry-stoichiometry' THEN 'chemistry-chemical-calculations'");
    expect(migration).toContain("WHEN 'e-math-geometry' THEN 'math-geometry-measurement'");
    expect(migration).toContain('CREATE TABLE "subtopics"');
    expect(migration).toContain('ADD COLUMN "subtopic_id" text');
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
