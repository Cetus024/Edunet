import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { assertDatabaseDeletionAllowed } from '../../../database/deleteDB.js';
import { assertSchemaCanBeInitialized } from '../../../database/schema-safety.js';
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
  it('counts non-relation schema objects before accepting an unmarked schema', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [{ object_count: 1 }] })
      .mockResolvedValueOnce({ rows: [{ marker_table: null }] });

    await expect(assertSchemaCanBeInitialized({ query } as unknown as Pool))
      .rejects.toThrow('has no valid EduNets ownership marker');

    const objectCountQuery = String(query.mock.calls[1]?.[0]);
    expect(objectCountQuery).toContain('pg_catalog.pg_class');
    expect(objectCountQuery).toContain('pg_catalog.pg_type');
    expect(objectCountQuery).toContain('pg_catalog.pg_proc');
    expect(objectCountQuery).toContain('pg_catalog.pg_extension');
  });
});
