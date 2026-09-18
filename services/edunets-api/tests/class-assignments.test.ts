import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  onboardingProfiles,
  schoolClasses,
  studentClassAssignments,
  teachingScopes,
} from '../../../database/schema/index.js';

describe('admin-managed Class assignments', () => {
  it('models one Class per student and unique teacher/Class/subject scopes', () => {
    const classes = getTableConfig(schoolClasses);
    const scopes = getTableConfig(teachingScopes);
    const studentAssignments = getTableConfig(studentClassAssignments);

    expect(classes.indexes.map((index) => index.config.name)).toContain('school_class_school_name_uidx');
    expect(scopes.indexes.map((index) => index.config.name)).toContain('teaching_scope_teacher_class_subject_uidx');
    expect(teachingScopes.classId.notNull).toBe(true);
    expect(studentClassAssignments.studentUserId.primary).toBe(true);
    expect(studentAssignments.foreignKeys).toHaveLength(2);
    expect(onboardingProfiles.subjectId.notNull).toBe(false);
  });

  it('migrates legacy scopes and assigns students in documented priority order', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0020_common_jamie_braddock.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "school_class"');
    expect(migration).toContain('CREATE TABLE "student_class_assignment"');
    expect(migration).toContain('FROM "classroom_enrollment" AS "enrollment"');
    expect(migration).toContain('lower(trim("user"."class"))');
    expect(migration).toContain('HAVING count(DISTINCT "candidate"."class_id") = 1');
    expect(migration).toContain('ON CONFLICT ("student_user_id") DO NOTHING');
    expect(migration).not.toMatch(/\bTRUNCATE\b/i);
  });

  it('repairs databases whose newer migration marker skipped the original Class migrations', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0021_repair_class_assignments.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "class"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public."school_class"');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public."student_class_assignment"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "class_id"');
    expect(migration).toContain('ON CONFLICT ("student_user_id") DO NOTHING');
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\s+(?:TABLE|SCHEMA)\b|\bDELETE\s+FROM\b/i);
  });
});
