export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const roundCoordinate = (value: number) => Number(value.toFixed(6));

export const normalizeConceptLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Rotates contiguous child blocks on the outer ring so their centres stay as
 * close as possible to the corresponding evenly spaced parent Topics.
 */
export function alignedOuterRingStart(childCounts: readonly number[], initialAngle = -Math.PI / 2): number {
  if (childCounts.length === 0) return initialAngle;
  const slotCounts = childCounts.map((count) => Math.max(1, count));
  const totalSlots = slotCounts.reduce((sum, count) => sum + count, 0);
  const slotStep = (Math.PI * 2) / totalSlots;
  const parentStep = (Math.PI * 2) / childCounts.length;
  let cursor = 0;
  const totalDrift = slotCounts.reduce((sum, count, topicIndex) => {
    const blockCenter = (cursor + (count - 1) / 2) * slotStep;
    cursor += count;
    return sum + blockCenter - topicIndex * parentStep;
  }, 0);
  return initialAngle - totalDrift / childCounts.length;
}
