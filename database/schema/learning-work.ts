import { sql } from 'drizzle-orm';
import { check, index, integer, jsonb, pgSchema, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { users } from './auth.js';
import type { DrawingStroke, WorkAnalysis } from '../../lib/learning-work.js';

export const learningWork = pgSchema(EDUNETS_SCHEMA_NAME).table('learning_work', {
  id: text('id').primaryKey(),
  roomKind: text('room_kind', { enum: ['rescue', 'revision'] }).notNull(),
  roomId: text('room_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionIndex: integer('question_index').notNull().default(0),
  runNumber: integer('run_number').notNull().default(0),
  question: text('question').notNull(),
  transcript: text('transcript').notNull(),
  strokes: jsonb('strokes').$type<DrawingStroke[]>().notNull(),
  analysis: jsonb('analysis').$type<WorkAnalysis>().notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  check('learning_work_kind_check', sql`${table.roomKind} in ('rescue', 'revision')`),
  index('learning_work_room_idx').on(table.roomKind, table.roomId, table.createdAt),
  uniqueIndex('learning_work_rescue_round_uidx').on(table.roomId, table.userId, table.runNumber, table.questionIndex)
    .where(sql`${table.roomKind} = 'rescue'`),
]);
