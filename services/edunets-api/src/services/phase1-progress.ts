import { and, eq, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { userTopicModeProgress, userTopicProgress } from '../../../../database/schema/learning.js';
import {
  KNOWLEDGE_MODEL_VERSION,
  calculateConceptMemory,
  calculateReminder,
  type AssessmentMode,
} from '../lib/knowledge-model.js';

export type ApiTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockTopic(transaction: ApiTransaction, userId: string, topicId: string) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`phase1:${userId}:${topicId}`}))`);
}

export async function loadModeProgress(
  transaction: ApiTransaction,
  userId: string,
  topicId: string,
  mode: AssessmentMode,
) {
  const [progress] = await transaction.select({
    mastery: userTopicModeProgress.mastery,
    lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
    quizAttempts: userTopicModeProgress.quizAttempts,
  }).from(userTopicModeProgress).where(and(
    eq(userTopicModeProgress.userId, userId),
    eq(userTopicModeProgress.topicId, topicId),
    eq(userTopicModeProgress.assessmentMode, mode),
  )).limit(1);
  return progress ?? null;
}

export async function commitModeProgress(input: {
  transaction: ApiTransaction;
  userId: string;
  topicId: string;
  mode: AssessmentMode;
  mastery: number;
  updatedAt: Date;
  incrementAttempt: boolean;
}) {
  const { transaction, userId, topicId, mode, mastery, updatedAt, incrementAttempt } = input;
  await transaction.insert(userTopicModeProgress).values({
    userId,
    topicId,
    assessmentMode: mode,
    mastery,
    lastUpdatedAt: updatedAt,
    quizAttempts: incrementAttempt ? 1 : 0,
    modelVersion: KNOWLEDGE_MODEL_VERSION,
    updatedAt,
  }).onConflictDoUpdate({
    target: [userTopicModeProgress.userId, userTopicModeProgress.topicId, userTopicModeProgress.assessmentMode],
    set: {
      mastery,
      lastUpdatedAt: updatedAt,
      modelVersion: KNOWLEDGE_MODEL_VERSION,
      updatedAt,
      ...(incrementAttempt ? { quizAttempts: sql`${userTopicModeProgress.quizAttempts} + 1` } : {}),
    },
  });

  const modeRows = await transaction.select({
    mode: userTopicModeProgress.assessmentMode,
    mastery: userTopicModeProgress.mastery,
    lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
    quizAttempts: userTopicModeProgress.quizAttempts,
  }).from(userTopicModeProgress).where(and(
    eq(userTopicModeProgress.userId, userId),
    eq(userTopicModeProgress.topicId, topicId),
  ));
  const concept = calculateConceptMemory(modeRows, updatedAt);
  if (concept.conceptMemory === null) throw new Error('Mode progress was not available after commit.');
  const reminder = calculateReminder(concept.conceptMemory, updatedAt);
  const quizAttempts = modeRows.reduce((sum, row) => sum + row.quizAttempts, 0);

  await transaction.insert(userTopicProgress).values({
    userId,
    topicId,
    nextReviewAt: reminder.nextReviewAt,
    reminderCalculatedAt: updatedAt,
    quizAttempts,
    updatedAt,
  }).onConflictDoUpdate({
    target: [userTopicProgress.userId, userTopicProgress.topicId],
    set: {
      nextReviewAt: reminder.nextReviewAt,
      reminderCalculatedAt: updatedAt,
      quizAttempts,
      updatedAt,
    },
  });

  return { concept, reminder };
}
