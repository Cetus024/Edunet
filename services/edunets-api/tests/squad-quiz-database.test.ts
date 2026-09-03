import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  squadQuizRoomAnswers,
  squadQuizRoomCompletions,
  squadQuizRoomParticipants,
  squadQuizRoomQuestions,
  squadQuizRooms,
} from '../../../database/schema/squad-quiz.js';

describe('live Squad quiz database schema', () => {
  it('persists rooms, one answer per round, presence, and immutable completions', () => {
    const rooms = getTableConfig(squadQuizRooms);
    const questions = getTableConfig(squadQuizRoomQuestions);
    const participants = getTableConfig(squadQuizRoomParticipants);
    const answers = getTableConfig(squadQuizRoomAnswers);
    const completions = getTableConfig(squadQuizRoomCompletions);

    expect(rooms.foreignKeys).toHaveLength(3);
    expect(questions.primaryKeys).toHaveLength(1);
    expect(participants.primaryKeys).toHaveLength(1);
    expect(answers.primaryKeys).toHaveLength(1);
    expect(completions.primaryKeys).toHaveLength(1);
    expect(participants.indexes.map((index) => index.config.name)).toContain('squad_quiz_participants_room_status_idx');
    expect(answers.indexes.map((index) => index.config.name)).toContain('squad_quiz_answers_room_question_idx');
  });

  it('adds the live room tables without deleting existing data', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0015_fat_lester.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');
    for (const table of [
      'squad_quiz_rooms',
      'squad_quiz_room_questions',
      'squad_quiz_room_participants',
      'squad_quiz_room_answers',
      'squad_quiz_room_completions',
    ]) {
      expect(migration).toContain(`CREATE TABLE "edunets"."${table}"`);
    }
    expect(migration).toContain("'squad_quiz_invitation'");
    expect(migration).not.toMatch(/\bDROP\s+TABLE\b|\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
  });
});
