export function calculateMemoryScore(percentCorrect: number): number {
  if (percentCorrect >= 90) return 95;
  if (percentCorrect >= 75) return 80;
  if (percentCorrect >= 55) return 62;
  if (percentCorrect >= 40) return 45;
  return 28;
}

export function calculatePercentCorrect(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    throw new RangeError('Invalid quiz totals');
  }
  return Math.round((correct / total) * 100);
}

export function calculateNextReviewAt(score: number, now = new Date()): Date {
  const daysUntilReview = score >= 85 ? 7 : score >= 65 ? 4 : score >= 45 ? 2 : 1;

  // Singapore has a fixed UTC+08 offset and no daylight-saving transitions.
  // Constructing in UTC makes the 09:00 review time independent of container TZ.
  const singaporeNow = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
  return new Date(Date.UTC(
    singaporeNow.getUTCFullYear(),
    singaporeNow.getUTCMonth(),
    singaporeNow.getUTCDate() + daysUntilReview,
    1,
    0,
    0,
    0,
  ));
}

export function familiarityScore(familiarity: 'new' | 'some' | 'well'): 20 | 50 | 80 {
  if (familiarity === 'new') return 20;
  if (familiarity === 'some') return 50;
  return 80;
}
