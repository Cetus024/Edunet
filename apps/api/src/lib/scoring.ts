export function calculatePercentCorrect(correct: number, total: number): number {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    throw new RangeError('Invalid quiz totals');
  }
  return Math.round((correct / total) * 100);
}
