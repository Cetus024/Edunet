import type { AnalysisModel } from './explanation-analysis.js';

/**
 * Turns captured notes (OCR'd handwriting, typed text, or both concatenated)
 * into a short list of key points.
 *
 * This is deliberately not grounded against the question bank the way
 * note-evaluation.ts is -- a summary reflects what the student actually wrote,
 * not what the syllabus says they should have. Judging it against the
 * reference is evaluateNotes()'s job; this one only has to compress.
 */

const MIN_WORDS = 8;
const MAX_POINTS = 6;

export function buildSummaryPrompt(notes: string): string {
  return [
    'Summarize a secondary school student\'s captured notes into key points.',
    '',
    'The text may come from OCR of handwriting, so characters can be misread',
    '(e.g. "1"/"l"/"I") and words can run together or split apart -- read past that',
    'rather than commenting on it.',
    '',
    `NOTES:\n"""${notes.trim()}"""`,
    '',
    `Return ONLY a JSON object, no prose and no code fence: {"points":["", ...]}.`,
    `Up to ${MAX_POINTS} points, each one idea, in the notes' own order. Use the student's`,
    'own terms rather than substituting your own vocabulary. If the notes are too short or',
    'too garbled to summarize, return {"points":[]}.',
  ].join('\n');
}

export function parseSummary(reply: string): string[] | null {
  const start = reply.indexOf('{');
  const end = reply.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(reply.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;

  const points = (parsed as Record<string, unknown>).points;
  if (!Array.isArray(points)) return null;
  return points.filter((point): point is string => typeof point === 'string' && point.trim().length > 0);
}

export async function summarizeNotes(notes: string, model: AnalysisModel): Promise<string[] | null> {
  if (notes.trim().split(/\s+/).length < MIN_WORDS) return null;
  const reply = await model.complete(buildSummaryPrompt(notes));
  return parseSummary(reply);
}
