import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { users } from './auth.js';
import { topics } from './catalog.js';
import { studySquads } from './study-squads.js';

const edunetsSchema = pgSchema(EDUNETS_SCHEMA_NAME);

const ROOM_STATUSES = ['active', 'finished'] as const;
const PARTICIPANT_STATUSES = ['invited', 'joined', 'answered', 'finished', 'left'] as const;
const AVATAR_COLORS = ['Yellow', 'LightBlue', 'White'] as const;

export const squadQuizRoomStatusEnum = { enumValues: ROOM_STATUSES };
export const squadQuizParticipantStatusEnum = { enumValues: PARTICIPANT_STATUSES };
export const squadQuizAvatarColorEnum = { enumValues: AVATAR_COLORS };

export const squadQuizRooms = edunetsSchema.table('squad_quiz_rooms', {
  id: text('id').primaryKey(),
  squadId: text('squad_id').notNull().references(() => studySquads.id, { onDelete: 'cascade' }),
  hostUserId: text('host_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id),
  status: text('status', { enum: ROOM_STATUSES }).notNull().default('active'),
  currentQuestionIndex: integer('current_question_index').notNull().default(0),
  totalRounds: integer('total_rounds').notNull(),
  questionStartedAt: timestamp('question_started_at').notNull(),
  restartCount: integer('restart_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
}, (table) => [
  index('squad_quiz_rooms_squad_created_idx').on(table.squadId, table.createdAt),
  index('squad_quiz_rooms_status_idx').on(table.status, table.updatedAt),
  check('squad_quiz_rooms_status_check', sql`${table.status} in ('active', 'finished')`),
  check('squad_quiz_rooms_rounds_check', sql`${table.totalRounds} between 1 and 10`),
  check('squad_quiz_rooms_question_index_check', sql`${table.currentQuestionIndex} >= 0 and ${table.currentQuestionIndex} < ${table.totalRounds}`),
]);

export const squadQuizRoomQuestions = edunetsSchema.table('squad_quiz_room_questions', {
  roomId: text('room_id').notNull().references(() => squadQuizRooms.id, { onDelete: 'cascade' }),
  questionIndex: integer('question_index').notNull(),
  questionKey: text('question_key').notNull(),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.questionIndex] }),
  uniqueIndex('squad_quiz_room_questions_key_uidx').on(table.roomId, table.questionKey),
  check('squad_quiz_room_questions_index_check', sql`${table.questionIndex} between 0 and 9`),
]);

export const squadQuizRoomParticipants = edunetsSchema.table('squad_quiz_room_participants', {
  roomId: text('room_id').notNull().references(() => squadQuizRooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  avatarColor: text('avatar_color', { enum: AVATAR_COLORS }).notNull().default('Yellow'),
  status: text('status', { enum: PARTICIPANT_STATUSES }).notNull().default('invited'),
  score: integer('score').notNull().default(0),
  lastAnswerCorrect: boolean('last_answer_correct'),
  joinedAt: timestamp('joined_at'),
  lastSeenAt: timestamp('last_seen_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.userId] }),
  index('squad_quiz_participants_room_status_idx').on(table.roomId, table.status),
  check('squad_quiz_participants_status_check', sql`${table.status} in ('invited', 'joined', 'answered', 'finished', 'left')`),
  check('squad_quiz_participants_avatar_check', sql`${table.avatarColor} in ('Yellow', 'LightBlue', 'White')`),
  check('squad_quiz_participants_score_check', sql`${table.score} >= 0`),
]);

export const squadQuizRoomAnswers = edunetsSchema.table('squad_quiz_room_answers', {
  roomId: text('room_id').notNull().references(() => squadQuizRooms.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  questionIndex: integer('question_index').notNull(),
  submittedAnswer: text('submitted_answer').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  points: integer('points').notNull(),
  answeredAt: timestamp('answered_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.userId, table.questionIndex] }),
  index('squad_quiz_answers_room_question_idx').on(table.roomId, table.questionIndex),
  check('squad_quiz_answers_points_check', sql`${table.points} in (0, 10)`),
]);

export const squadQuizRoomCompletions = edunetsSchema.table('squad_quiz_room_completions', {
  roomId: text('room_id').notNull().references(() => squadQuizRooms.id, { onDelete: 'cascade' }),
  runNumber: integer('run_number').notNull(),
  completedAt: timestamp('completed_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.roomId, table.runNumber] }),
  index('squad_quiz_completions_created_idx').on(table.completedAt),
  check('squad_quiz_completions_run_check', sql`${table.runNumber} >= 0`),
]);
