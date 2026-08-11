export type ClassTopicProgress = {
  memoryScore: number;
  lastReviewedAt: Date;
  nextReviewAt: Date;
  quizAttempts: number;
};

export function summarizeClassTopic(
  classSize: number,
  progressRows: readonly ClassTopicProgress[],
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

  const scoreTotal = progressRows.reduce((sum, progress) => sum + progress.memoryScore, 0);
  const lastReviewedAt = progressRows.reduce<Date | null>((latest, progress) => (
    !latest || progress.lastReviewedAt > latest ? progress.lastReviewedAt : latest
  ), null);
  const nextReviewAt = progressRows.reduce<Date | null>((earliest, progress) => (
    !earliest || progress.nextReviewAt < earliest ? progress.nextReviewAt : earliest
  ), null);

  return {
    memoryScore: Math.round(scoreTotal / classSize),
    participatingStudents: progressRows.length,
    lastReviewedAt,
    nextReviewAt,
    quizAttempts: progressRows.reduce((sum, progress) => sum + progress.quizAttempts, 0),
  };
}
