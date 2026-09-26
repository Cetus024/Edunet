import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { ACTIVE_SUBJECT_IDS } from '../../../../packages/database/constants.js';
import { db } from '../../../../packages/database/index.js';
import { topics } from '../../../../packages/database/schema/catalog.js';
import {
  quizAttempts,
  quizAttemptAnswers,
  quizAttemptQuestions,
  userTopicModeProgress,
  userTopicProgress,
} from '../../../../packages/database/schema/learning.js';
import * as Curriculum from '../../../../apps/web/lib/curriculum.js';
import type { CurriculumTopic } from '../../../../apps/web/lib/curriculum.js';
import {
  PHASE1_PARAMETERS,
  calculateConceptMemory,
  calculateEssayMastery,
  calculateMcqMastery,
  type ModeProgressInput,
} from '../lib/knowledge-model.js';

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
    memoryScore: number | null;
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
  const [databaseTopicRows, modeRows, reminderRows, userSubtopicQuestions] = await Promise.all([
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
    db.select({
      subtopicId: quizAttemptQuestions.subtopicId,
      mode: quizAttempts.quizMode,
      isCorrect: quizAttemptAnswers.isCorrect,
      marksObtained: quizAttemptAnswers.marksObtained,
      maximumMarks: quizAttemptAnswers.maximumMarks,
      completedAt: sql<Date>`coalesce(${quizAttempts.completedAt}, ${quizAttempts.submittedAt}, ${quizAttempts.startedAt})`,
    })
      .from(quizAttempts)
      .innerJoin(quizAttemptQuestions, eq(quizAttemptQuestions.attemptId, quizAttempts.id))
      .innerJoin(
        quizAttemptAnswers,
        and(
          eq(quizAttemptAnswers.attemptId, quizAttempts.id),
          eq(quizAttemptAnswers.questionIndex, quizAttemptQuestions.questionIndex),
        ),
      )
      .where(
        and(
          eq(quizAttempts.userId, userId),
          isNotNull(quizAttemptQuestions.subtopicId),
          // Exclude placement quizzes — they are diagnostic only and must not
          // contribute to the learner's ongoing knowledge scores.
          inArray(quizAttempts.quizMode, ['mcq', 'essay']),
        ),
      ),
  ]);

  const curriculumTopicIdByDatabaseId = new Map<string, string>();
  for (const topic of databaseTopicRows) {
    const canonical = Curriculum.resolveCurriculumTopic(topic.id) ?? Curriculum.resolveCurriculumTopic(topic.name);
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

  type SubtopicAnswer = (typeof userSubtopicQuestions)[number];
  const subtopicAnswersMap = new Map<string, SubtopicAnswer[]>();
  for (const row of userSubtopicQuestions) {
    if (!row.subtopicId) continue;
    const list = subtopicAnswersMap.get(row.subtopicId) ?? [];
    list.push(row);
    subtopicAnswersMap.set(row.subtopicId, list);
  }

  const subtopicScoreMap = new Map<string, number | null>();
  for (const [subtopicId, answers] of subtopicAnswersMap.entries()) {
    // Only count answers from the matching mode — the old `|| a.isCorrect !== null`
    // condition was accidentally pulling essay/placement rows into the MCQ bucket.
    const mcqAnswers = answers.filter((a) => a.mode === 'mcq');
    const essayAnswers = answers.filter((a) => a.mode === 'essay' && a.maximumMarks !== null);
    const modeInputs: ModeProgressInput[] = [];

    if (mcqAnswers.length > 0) {
      const correct = mcqAnswers.filter((a) => a.isCorrect === true).length;
      const wrong = mcqAnswers.length - correct;
      const latestDate = mcqAnswers.reduce<Date>(
        (latest, a) => {
          const d = a.completedAt instanceof Date ? a.completedAt : new Date(a.completedAt ?? 0);
          return d.getTime() > latest.getTime() ? d : latest;
        },
        mcqAnswers[0]?.completedAt instanceof Date ? mcqAnswers[0].completedAt : new Date(mcqAnswers[0]?.completedAt ?? 0),
      );
      const mcqCalc = calculateMcqMastery({
        previousMastery: PHASE1_PARAMETERS.initialMastery,
        elapsedDays: 0,
        correct,
        wrong,
      });
      modeInputs.push({
        mode: 'mcq',
        mastery: mcqCalc.posteriorMastery,
        lastUpdatedAt: latestDate,
        quizAttempts: 1,
      });
    }

    if (essayAnswers.length > 0) {
      const marksObtained = essayAnswers.reduce((sum, a) => sum + (a.marksObtained ?? 0), 0);
      const maximumMarks = essayAnswers.reduce((sum, a) => sum + (a.maximumMarks ?? 0), 0);
      const latestDate = essayAnswers.reduce<Date>(
        (latest, a) => {
          const d = a.completedAt instanceof Date ? a.completedAt : new Date(a.completedAt ?? 0);
          return d.getTime() > latest.getTime() ? d : latest;
        },
        essayAnswers[0]?.completedAt instanceof Date ? essayAnswers[0].completedAt : new Date(essayAnswers[0]?.completedAt ?? 0),
      );
      const essayCalc = calculateEssayMastery({
        previousMastery: PHASE1_PARAMETERS.initialMastery,
        elapsedDays: 0,
        marksObtained,
        maximumMarks,
      });
      modeInputs.push({
        mode: 'essay',
        mastery: essayCalc.posteriorMastery,
        lastUpdatedAt: latestDate,
        quizAttempts: 1,
      });
    }

    if (modeInputs.length > 0) {
      const subtopicConcept = calculateConceptMemory(modeInputs, calculatedAt);
      subtopicScoreMap.set(subtopicId, subtopicConcept.conceptMemoryScore);
    }
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

    // Calculate memory score per subtopic
    const subtopicsWithScore = topic.subtopics.map((child) => ({
      ...child,
      topicId: topic.id,
      memoryScore: subtopicScoreMap.get(child.id) ?? null,
    }));

    // A topic with zero quiz attempts can have conceptMemoryScore=0 from the
    // knowledge model if mastery decays to exactly 0 — treat 0 the same as
    // null so it renders as "Not Started" (grey) rather than red.
    const startedSubtopics = subtopicsWithScore.filter((child) => child.memoryScore !== null && child.memoryScore > 0);
    const themeMemoryScore = startedSubtopics.length > 0
      ? Math.round(startedSubtopics.reduce((sum, child) => sum + child.memoryScore!, 0) / startedSubtopics.length)
      : (concept.conceptMemoryScore || null);

    return {
      id: topic.id,
      subjectId: topic.subjectId,
      syllabusCode: topic.syllabusCode,
      name: topic.name,
      description: topic.description,
      subtopics: subtopicsWithScore,
      memoryScore: themeMemoryScore,
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
    subjects: Curriculum.CURRICULUM.map((subject) => ({
      id: subject.id,
      name: subject.name,
      syllabusCode: subject.syllabusCode,
      icon: subject.icon,
      topics: subject.topics.map(buildTopic),
    })),
  };
}
