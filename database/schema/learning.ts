import { sql } from 'drizzle-orm';
import { bigint, boolean, check, integer, pgTable, primaryKey, real, text, timestamp } from 'drizzle-orm/pg-core';
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
  initialMemoryScore: real('initial_memory_score'),
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
  resultingMemoryScore: real('resulting_memory_score').notNull(),
  startedAt: timestamp('started_at'),
  submittedAt: timestamp('submitted_at').notNull(),
});

export const quizAttemptAnswers = pgTable('quiz_attempt_answer', {
  attemptId: text('attempt_id').notNull().references(() => quizAttempts.id, { onDelete: 'cascade' }),
  questionKey: text('question_key').notNull(),
  questionIndex: integer('question_index').notNull(),
  submittedAnswer: text('submitted_answer').$type<string | number>().notNull(),
  isCorrect: boolean('is_correct').notNull(),
}, (table) => [
  primaryKey({ columns: [table.attemptId, table.questionKey] }),
]);

export const userTopicProgress = pgTable('user_topic_progress', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id),
  memoryScore: real('memory_score').notNull(),
  lastReviewedAt: timestamp('last_reviewed_at').notNull(),
  nextReviewAt: timestamp('next_review_at').notNull(),
  quizAttempts: integer('quiz_attempts').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.userId, table.topicId] }),
]);
