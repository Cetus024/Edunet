import { calculateDynamicProgress } from './knowledge-model.js';

export type ClassTopicProgress = {
  mastery: number;
  stabilityDays: number;
  lastReviewedAt: Date;
  quizAttempts: number;
};

export function summarizeClassTopic(
  classSize: number,
  progressRows: readonly ClassTopicProgress[],
  calculatedAt = new Date(),
) {
  if (classSize <= 0 || progressRows.length === 0) {
    return {
      memoryScore: null,
      participatingStudents: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      quizAttempts: 0,
    };
  }

  const dynamicRows = progressRows.map((progress) => ({
    ...progress,
    dynamic: calculateDynamicProgress(progress.mastery, progress.stabilityDays, progress.lastReviewedAt, calculatedAt),
  }));
  const scoreTotal = dynamicRows.reduce((sum, progress) => sum + progress.dynamic.memoryScore, 0);
  const lastReviewedAt = progressRows.reduce<Date | null>((latest, progress) => (
    !latest || progress.lastReviewedAt > latest ? progress.lastReviewedAt : latest
  ), null);
  const nextReviewAt = dynamicRows.reduce<Date | null>((earliest, progress) => {
    const next = progress.dynamic.nextReviewAt;
    if (!next) return earliest;
    return !earliest || next < earliest ? next : earliest;
  }, null);

  return {
    memoryScore: Math.round(scoreTotal / classSize),
    participatingStudents: progressRows.length,
    lastReviewedAt,
    nextReviewAt,
    quizAttempts: progressRows.reduce((sum, progress) => sum + progress.quizAttempts, 0),
  };
}
