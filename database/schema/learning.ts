import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { schools, subjects, topics } from './catalog.js';

export const profiles = pgTable('profile', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(),
  schoolId: text('school_id').notNull(),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  onboardingCompletedAt: timestamp('onboarding_completed_at'),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  check('profile_role_check', sql`${table.role} in ('student', 'teacher')`),
]);

export const onboardingProfiles = pgTable('onboarding_profile', {
  userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  learningSource: text('learning_source').notNull(),
  materialName: text('material_name'),
  materialType: text('material_type'),
  materialSize: integer('material_size'),
  materialLastModified: bigint('material_last_modified', { mode: 'number' }),
  recordingDurationSeconds: integer('recording_duration_seconds'),
  recordingMimeType: text('recording_mime_type'),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  topicId: text('topic_id').references(() => topics.id),
  initialMastery: doublePrecision('initial_memory_score'),
  placementAttemptId: text('placement_attempt_id').unique().references(() => quizAttempts.id, { onDelete: 'set null' }),
  completedAt: timestamp('completed_at').notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const questionReviews = pgTable('question_review', {
  questionKey: text('question_key').primaryKey(),
  editedExplanation: text('edited_explanation').notNull(),
  reviewedByUserId: text('reviewed_by_user_id').notNull().references(() => users.id),
  reviewedAt: timestamp('reviewed_at').notNull().defaultNow(),
});

export const teachingScopes = pgTable('teaching_scope', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  schoolId: text('school_id').notNull().references(() => schools.id),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  classroomName: text('classroom_name').notNull(),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Explicit teacher-added roster membership, layered on top of the implicit
// school+subject match (see listStudentsInScope) rather than replacing it -
// a teacher can pull in a student who hasn't picked their exact subject (or
// is at a different school) without that student's own onboarding choices
// being overwritten.
export const classroomEnrollments = pgTable('classroom_enrollment', {
  teachingScopeId: text('teaching_scope_id').notNull().references(() => teachingScopes.id, { onDelete: 'cascade' }),
  studentUserId: text('student_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addedAt: timestamp('added_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.teachingScopeId, table.studentUserId] }),
]);

export const quizAttempts = pgTable('quiz_attempt', {
  id: text('id').primaryKey(),
  submissionId: text('submission_id').notNull().unique(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subjectId: text('subject_id').notNull(),
  topicId: text('topic_id').notNull(),
  quizMode: text('quiz_mode', { enum: ['past-paper', 'concept-check', 'speed-round', 'placement'] as const }).notNull(),
  questionSetVersion: text('question_set_version').notNull(),
  correctAnswers: integer('correct_answers').notNull(),
  totalQuestions: integer('total_questions').notNull(),
  percentCorrect: real('percent_correct').notNull(),
  resultingMemoryScore: real('resulting_memory_score'),
  status: text('status', { enum: ['in_progress', 'completed', 'abandoned'] as const }).notNull().default('completed'),
  modelVersion: text('model_version').notNull().default('legacy-tier-v0'),
  initialMastery: doublePrecision('initial_mastery'),
  currentMastery: doublePrecision('current_mastery'),
  stabilityBefore: doublePrecision('stability_before'),
  stabilityAfter: doublePrecision('stability_after'),
  successfulReviewsBefore: integer('successful_reviews_before'),
  successfulReviewsAfter: integer('successful_reviews_after'),
  startedAt: timestamp('started_at'),
  submittedAt: timestamp('submitted_at').notNull(),
  completedAt: timestamp('completed_at'),
  abandonedAt: timestamp('abandoned_at'),
}, (table) => [
  check('quiz_attempt_status_check', sql`${table.status} in ('in_progress', 'completed', 'abandoned')`),
  uniqueIndex('quiz_attempt_one_active_speed_topic_idx')
    .on(table.userId, table.topicId)
    .where(sql`${table.quizMode} = 'speed-round' and ${table.status} = 'in_progress'`),
]);

export const quizAttemptQuestions = pgTable('quiz_attempt_question', {
  attemptId: text('attempt_id').notNull().references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionIndex: integer('question_index').notNull(),
  questionKey: text('question_key').notNull(),
  type: text('type').notNull(),
  topic: text('topic').notNull(),
  text: text('text').notNull(),
  options: jsonb('options').$type<string[]>(),
  correctAnswer: jsonb('correct_answer').$type<string | number>().notNull(),
  explanation: text('explanation').notNull(),
  linkedConcept: text('linked_concept').notNull(),
  source: text('source'),
  resourceNumber: text('resource_number'),
}, (table) => [
  primaryKey({ columns: [table.attemptId, table.questionIndex] }),
  uniqueIndex('quiz_attempt_question_key_idx').on(table.attemptId, table.questionKey),
]);

export const quizAttemptAnswers = pgTable('quiz_attempt_answer', {
  attemptId: text('attempt_id').notNull().references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionKey: text('question_key').notNull(),
  questionIndex: integer('question_index').notNull(),
  submittedAnswer: text('submitted_answer').$type<string | number>().notNull(),
  isCorrect: boolean('is_correct').notNull(),
  priorMastery: doublePrecision('prior_mastery'),
  posteriorMastery: doublePrecision('posterior_mastery'),
  masteryAfterTransition: doublePrecision('mastery_after_transition'),
  predictedCorrectness: doublePrecision('predicted_correctness'),
  calculationTrace: jsonb('calculation_trace').$type<Record<string, unknown>>(),
  answeredAt: timestamp('answered_at'),
}, (table) => [
  primaryKey({ columns: [table.attemptId, table.questionKey] }),
  uniqueIndex('quiz_attempt_answer_index_idx').on(table.attemptId, table.questionIndex),
]);

export const userTopicProgress = pgTable('user_topic_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id),
  mastery: doublePrecision('mastery').notNull(),
  stabilityDays: doublePrecision('stability_days').notNull(),
  successfulReviews: integer('successful_reviews').notNull().default(0),
  modelVersion: text('model_version').notNull().default('bkt-v1'),
  lastReviewedAt: timestamp('last_reviewed_at').notNull(),
  quizAttempts: integer('quiz_attempts').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.topicId] }),
  check('user_topic_progress_mastery_check', sql`${table.mastery} >= 0 and ${table.mastery} <= 1`),
  check('user_topic_progress_stability_check', sql`${table.stabilityDays} > 0`),
  check('user_topic_progress_successful_reviews_check', sql`${table.successfulReviews} >= 0`),
]);
