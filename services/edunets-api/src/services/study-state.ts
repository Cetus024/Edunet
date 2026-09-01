import { asc, eq } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { userTopicProgress } from '../../../../database/schema/learning.js';
import { calculateDynamicProgress } from '../lib/knowledge-model.js';

export type StudyStateTopic = {
  id: string;
  subjectId: string;
  name: string;
  memoryScore: number | null;
  masteryScore: number | null;
  stabilityDays: number | null;
  successfulReviews: number;
  reviewNow: boolean;
  calculatedAt: Date;
  lastReviewedAt: Date | null;
  nextReviewAt: Date | null;
  quizAttempts: number;
};

export type StudyStateSubject = {
  id: string;
  name: string;
  icon: string | null;
  topics: StudyStateTopic[];
};

/**
 * The full subject/topic catalog with a given user's progress layered on
 * top. Shared by the user's own `/me/study-state` and by anything that
 * needs to read a *different* user's real progress read-only (e.g. a
 * another authorized view of the same learner).
 */
export async function getStudyStateForUser(userId: string): Promise<{ subjects: StudyStateSubject[] }> {
  const calculatedAt = new Date();
  const [subjectRows, topicRows, progressRows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
      .from(subjects)
      .orderBy(asc(subjects.position)),
    db.select({ id: topics.id, subjectId: topics.subjectId, name: topics.name })
      .from(topics)
      .orderBy(asc(topics.subjectId), asc(topics.position)),
    db.select({
      topicId: userTopicProgress.topicId,
      mastery: userTopicProgress.mastery,
      stabilityDays: userTopicProgress.stabilityDays,
      successfulReviews: userTopicProgress.successfulReviews,
      lastReviewedAt: userTopicProgress.lastReviewedAt,
      quizAttempts: userTopicProgress.quizAttempts,
    })
      .from(userTopicProgress)
      .where(eq(userTopicProgress.userId, userId)),
  ]);

  const progressByTopic = new Map(progressRows.map((progress) => [progress.topicId, progress]));
  const topicsBySubject = new Map<string, StudyStateTopic[]>();

  for (const topic of topicRows) {
    const progress = progressByTopic.get(topic.id);
    const dynamic = progress
      ? calculateDynamicProgress(progress.mastery, progress.stabilityDays, progress.lastReviewedAt, calculatedAt)
      : null;
    const list = topicsBySubject.get(topic.subjectId) ?? [];
    list.push({
      ...topic,
      memoryScore: dynamic?.memoryScore ?? null,
      masteryScore: dynamic?.masteryScore ?? null,
      stabilityDays: progress?.stabilityDays ?? null,
      successfulReviews: progress?.successfulReviews ?? 0,
      reviewNow: dynamic?.reviewNow ?? false,
      calculatedAt,
      lastReviewedAt: progress?.lastReviewedAt ?? null,
      nextReviewAt: dynamic?.nextReviewAt ?? null,
      quizAttempts: progress?.quizAttempts ?? 0,
    });
    topicsBySubject.set(topic.subjectId, list);
  }

  return {
    subjects: subjectRows.map((subject) => ({
      ...subject,
      topics: topicsBySubject.get(subject.id) ?? [],
    })),
  };
}
