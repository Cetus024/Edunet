import { calculateConceptMemory, type AssessmentMode } from './knowledge-model.js';

export type ClassTopicProgress = {
  userId: string;
  mode: AssessmentMode;
  mastery: number;
  lastUpdatedAt: Date;
  quizAttempts: number;
};

export function summarizeClassTopic(
  classSize: number,
  progressRows: readonly ClassTopicProgress[],
  calculatedAt = new Date(),
  reminderDates: readonly Date[] = [],
) {
  if (classSize <= 0 || progressRows.length === 0) {
    return { memoryScore: null, participatingStudents: 0, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 };
  }
  const byStudent = new Map<string, ClassTopicProgress[]>();
  for (const row of progressRows) {
    const rows = byStudent.get(row.userId) ?? [];
    rows.push(row);
    byStudent.set(row.userId, rows);
  }
  const studentScores = [...byStudent.values()]
    .map((rows) => calculateConceptMemory(rows, calculatedAt).conceptMemoryScore)
    .filter((score): score is number => score !== null);
  const lastReviewedAt = progressRows.reduce<Date | null>((latest, progress) => (
    latest === null || progress.lastUpdatedAt > latest ? progress.lastUpdatedAt : latest
  ), null);
  return {
    memoryScore: Math.round(studentScores.reduce((sum, score) => sum + score, 0) / classSize),
    participatingStudents: studentScores.length,
    lastReviewedAt,
    nextReviewAt: reminderDates.length > 0
      ? new Date(Math.min(...reminderDates.map((date) => date.getTime())))
      : null,
    quizAttempts: progressRows.reduce((sum, progress) => sum + progress.quizAttempts, 0),
  };
}
