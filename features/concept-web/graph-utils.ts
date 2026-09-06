export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const roundCoordinate = (value: number) => Number(value.toFixed(6));

export const normalizeConceptLabel = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export type ConceptNodeKind = 'subject' | 'topic' | 'subconcept';

export const CONCEPT_WEB_LAYOUT = Object.freeze({
  width: 1200,
  height: 1050,
  centerX: 600,
  centerY: 525,
  subjectRadius: 74,
  topicRingRadius: 270,
  topicRadius: 62,
  subtopicRingRadius: 430,
  subtopicRadius: 44,
  viewportMargin: 140,
});

export const CONCEPT_WEB_VIEW_BOX = `0 0 ${CONCEPT_WEB_LAYOUT.width} ${CONCEPT_WEB_LAYOUT.height}`;

type TypographyConfig = {
  maxCharacters: number;
  maxLines: number;
  fontSize: number;
  minimumFontSize: number;
  lineHeight: number;
};

const NODE_TYPOGRAPHY: Record<ConceptNodeKind, TypographyConfig> = {
  subject: { maxCharacters: 14, maxLines: 2, fontSize: 18, minimumFontSize: 16, lineHeight: 20 },
  topic: { maxCharacters: 14, maxLines: 4, fontSize: 13, minimumFontSize: 11, lineHeight: 15 },
  subconcept: { maxCharacters: 14, maxLines: 4, fontSize: 10, minimumFontSize: 8.5, lineHeight: 11 },
};

function lineLength(words: readonly string[]): number {
  return words.reduce((length, word) => length + word.length, Math.max(0, words.length - 1));
}

/**
 * Finds the least-ragged set of contiguous lines for a requested line count.
 * Overflow is weighted heavily, while preserving word order and every word.
 */
function balancedPartition(words: readonly string[], lineCount: number, maxCharacters: number): string[] {
  const targetLength = lineLength(words) / lineCount;
  let bestLines: string[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const visit = (start: number, remainingLines: number, lines: string[]) => {
    if (remainingLines === 1) {
      const finalWords = words.slice(start);
      if (finalWords.length === 0) return;
      const candidate = [...lines, finalWords.join(' ')];
      const lengths = candidate.map((line) => line.length);
      const overflow = lengths.reduce((sum, length) => sum + Math.max(0, length - maxCharacters) ** 2, 0);
      const raggedness = lengths.reduce((sum, length) => sum + (length - targetLength) ** 2, 0);
      const score = overflow * 10_000 + raggedness;
      if (score < bestScore) {
        bestScore = score;
        bestLines = candidate;
      }
      return;
    }

    const lastEnd = words.length - remainingLines + 1;
    for (let end = start + 1; end <= lastEnd; end += 1) {
      visit(end, remainingLines - 1, [...lines, words.slice(start, end).join(' ')]);
    }
  };

  visit(0, lineCount, []);
  return bestLines ?? [words.join(' ')];
}

export function getConceptNodeTypography(label: string, kind: ConceptNodeKind) {
  const config = NODE_TYPOGRAPHY[kind];
  const normalizedLabel = label.trim().replace(/\s+/g, ' ');
  const words = normalizedLabel ? normalizedLabel.split(' ') : [''];
  let lines = [normalizedLabel];

  for (let lineCount = 1; lineCount <= Math.min(config.maxLines, words.length); lineCount += 1) {
    const candidate = balancedPartition(words, lineCount, config.maxCharacters);
    lines = candidate;
    if (candidate.every((line) => line.length <= config.maxCharacters)) break;
  }

  const longestLine = Math.max(1, ...lines.map((line) => line.length));
  const fontSize = Math.max(
    config.minimumFontSize,
    roundCoordinate(config.fontSize * Math.min(1, config.maxCharacters / longestLine)),
  );

  return {
    lines,
    fontSize,
    lineHeight: config.lineHeight,
    maxLines: config.maxLines,
  };
}

/** Converts a browser pointer location into the SVG's viewBox coordinate space. */
export function clientPointToConceptSvg(
  svg: SVGSVGElement | null,
  clientX: number,
  clientY: number,
): { x: number; y: number } | null {
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return null;
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
}

/**
 * Rotates contiguous child blocks on the outer ring so their centres stay as
 * close as possible to the corresponding evenly spaced parent Topics.
 */
export function alignedOuterRingStart(childCounts: readonly number[], initialAngle = -Math.PI / 2): number {
  if (childCounts.length === 0) return initialAngle;
  const slotCounts = childCounts.map((count) => Math.max(0, count));
  const totalSlots = slotCounts.reduce((sum, count) => sum + count, 0);
  if (totalSlots === 0) return initialAngle;
  const slotStep = (Math.PI * 2) / totalSlots;
  const parentStep = (Math.PI * 2) / childCounts.length;
  let cursor = 0;
  let populatedTopics = 0;
  const totalDrift = slotCounts.reduce((sum, count, topicIndex) => {
    if (count === 0) return sum;
    const blockCenter = (cursor + (count - 1) / 2) * slotStep;
    cursor += count;
    populatedTopics += 1;
    return sum + blockCenter - topicIndex * parentStep;
  }, 0);
  return initialAngle - totalDrift / populatedTopics;
}
