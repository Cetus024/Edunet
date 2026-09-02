import { asc, eq } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { userTopicModeProgress, userTopicProgress } from '../../../../database/schema/learning.js';
import { PHASE1_PARAMETERS, calculateConceptMemory } from '../lib/knowledge-model.js';

export type StudyStateTopic = {
  id: string;
  subjectId: string;
  name: string;
  memoryScore: number | null;
  modeScores: ReturnType<typeof calculateConceptMemory>['modes'];
  recommendedMode: 'mcq' | 'essay' | null;
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

export async function getStudyStateForUser(userId: string): Promise<{ subjects: StudyStateSubject[] }> {
  const calculatedAt = new Date();
  const [subjectRows, topicRows, modeRows, reminderRows] = await Promise.all([
    db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
      .from(subjects).orderBy(asc(subjects.position)),
    db.select({ id: topics.id, subjectId: topics.subjectId, name: topics.name })
      .from(topics).orderBy(asc(topics.subjectId), asc(topics.position)),
    db.select({
      topicId: userTopicModeProgress.topicId,
      mode: userTopicModeProgress.assessmentMode,
      mastery: userTopicModeProgress.mastery,
      lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
      quizAttempts: userTopicModeProgress.quizAttempts,
    }).from(userTopicModeProgress).where(eq(userTopicModeProgress.userId, userId)),
    db.select({ topicId: userTopicProgress.topicId, nextReviewAt: userTopicProgress.nextReviewAt })
      .from(userTopicProgress).where(eq(userTopicProgress.userId, userId)),
  ]);

  const modesByTopic = new Map<string, typeof modeRows>();
  for (const row of modeRows) {
    const list = modesByTopic.get(row.topicId) ?? [];
    list.push(row);
    modesByTopic.set(row.topicId, list);
  }
  const reminderByTopic = new Map(reminderRows.map((row) => [row.topicId, row.nextReviewAt]));
  const topicsBySubject = new Map<string, StudyStateTopic[]>();

  for (const topic of topicRows) {
    const rows = modesByTopic.get(topic.id) ?? [];
    const concept = calculateConceptMemory(rows, calculatedAt);
    const nextReviewAt = reminderByTopic.get(topic.id) ?? null;
    const lastReviewedAt = rows.reduce<Date | null>((latest, row) => (
      latest === null || row.lastUpdatedAt > latest ? row.lastUpdatedAt : latest
    ), null);
    const list = topicsBySubject.get(topic.subjectId) ?? [];
    list.push({
      ...topic,
      memoryScore: concept.conceptMemoryScore,
      modeScores: concept.modes,
      recommendedMode: concept.recommendedMode,
      reviewNow: concept.conceptMemory !== null && (
        concept.conceptMemory <= PHASE1_PARAMETERS.memoryThreshold
        || (nextReviewAt !== null && nextReviewAt <= calculatedAt)
      ),
      calculatedAt,
      lastReviewedAt,
      nextReviewAt,
      quizAttempts: rows.reduce((sum, row) => sum + row.quizAttempts, 0),
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
