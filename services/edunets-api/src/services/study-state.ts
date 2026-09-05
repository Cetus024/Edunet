import { asc, eq, inArray } from 'drizzle-orm';

import { ACTIVE_SUBJECT_IDS } from '../../../../database/constants.js';
import { db } from '../../../../database/index.js';
import { topics } from '../../../../database/schema/catalog.js';
import { userTopicModeProgress, userTopicProgress } from '../../../../database/schema/learning.js';
import {
  CURRICULUM,
  resolveCurriculumTopic,
  type CurriculumTopic,
} from '../../../../lib/curriculum.js';
import { PHASE1_PARAMETERS, calculateConceptMemory } from '../lib/knowledge-model.js';

export type StudyStateTopic = {
  id: string;
  subjectId: string;
  syllabusCode: string;
  name: string;
  description: string;
  subtopics: Array<{
    id: string;
    topicId: string;
    syllabusCode: string;
    name: string;
    description: string;
  }>;
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
  syllabusCode: string;
  icon: string | null;
  topics: StudyStateTopic[];
};

export async function getStudyStateForUser(userId: string): Promise<{ subjects: StudyStateSubject[] }> {
  const calculatedAt = new Date();
  const activeSubjectIds: string[] = [...ACTIVE_SUBJECT_IDS];
  const [databaseTopicRows, modeRows, reminderRows] = await Promise.all([
    db.select({
      id: topics.id,
      subjectId: topics.subjectId,
      name: topics.name,
    })
      .from(topics)
      .where(inArray(topics.subjectId, activeSubjectIds))
      .orderBy(asc(topics.subjectId), asc(topics.position)),
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

  const curriculumTopicIdByDatabaseId = new Map<string, string>();
  for (const topic of databaseTopicRows) {
    const canonical = resolveCurriculumTopic(topic.id) ?? resolveCurriculumTopic(topic.name);
    if (canonical?.subjectId === topic.subjectId) {
      curriculumTopicIdByDatabaseId.set(topic.id, canonical.id);
    }
  }

  type ModeRow = (typeof modeRows)[number];
  const modesByTopicAndMode = new Map<string, Map<ModeRow['mode'], ModeRow[]>>();
  for (const row of modeRows) {
    const canonicalId = curriculumTopicIdByDatabaseId.get(row.topicId);
    if (!canonicalId) continue;
    const byMode = modesByTopicAndMode.get(canonicalId) ?? new Map<ModeRow['mode'], ModeRow[]>();
    const list = byMode.get(row.mode) ?? [];
    list.push(row);
    byMode.set(row.mode, list);
    modesByTopicAndMode.set(canonicalId, byMode);
  }

  const remindersByTopic = new Map<string, Date[]>();
  for (const row of reminderRows) {
    const canonicalId = curriculumTopicIdByDatabaseId.get(row.topicId);
    if (!canonicalId) continue;
    const list = remindersByTopic.get(canonicalId) ?? [];
    list.push(row.nextReviewAt);
    remindersByTopic.set(canonicalId, list);
  }

  function buildTopic(topic: CurriculumTopic): StudyStateTopic {
    const rows = [...(modesByTopicAndMode.get(topic.id)?.values() ?? [])]
      .map((entries) => {
        const latest = entries.reduce((current, candidate) => (
          candidate.lastUpdatedAt > current.lastUpdatedAt ? candidate : current
        ));
        return {
          ...latest,
          quizAttempts: entries.reduce((sum, entry) => sum + entry.quizAttempts, 0),
        };
      });
    const concept = calculateConceptMemory(rows, calculatedAt);
    const nextReviewAt = (remindersByTopic.get(topic.id) ?? []).reduce<Date | null>((earliest, date) => (
      earliest === null || date < earliest ? date : earliest
    ), null);
    const lastReviewedAt = rows.reduce<Date | null>((latest, row) => (
      latest === null || row.lastUpdatedAt > latest ? row.lastUpdatedAt : latest
    ), null);
    return {
      id: topic.id,
      subjectId: topic.subjectId,
      syllabusCode: topic.syllabusCode,
      name: topic.name,
      description: topic.description,
      subtopics: topic.subtopics.map((child) => ({ ...child, topicId: topic.id })),
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
    };
  }

  return {
    subjects: CURRICULUM.map((subject) => ({
      id: subject.id,
      name: subject.name,
      syllabusCode: subject.syllabusCode,
      icon: subject.icon,
      topics: subject.topics.map(buildTopic),
    })),
  };
}
