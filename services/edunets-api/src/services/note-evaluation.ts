import {
  buildTopicGrounding,
  type AnalysisModel,
  type TopicGrounding,
} from './explanation-analysis.js';

/**
 * Judges Capture Hub notes against the same syllabus grounding
 * explanation-analysis.ts uses for the discussion room, with two differences
 * that matter enough to keep this a separate module rather than a branch
 * inside that one:
 *
 * 1. The source is a generated summary of OCR'd handwriting and typed text,
 *    not speech-to-text. The summary is evaluated only after the capture step
 *    has normalized the raw notes, keeping the comparison focused and cheap.
 * 2. The output carries a percentage. Capture Hub asked for a score a student
 *    can see at a glance, not just a breakdown to read. The score is never
 *    asked of the model directly -- models are not reliable, self-consistent
 *    graders -- it is computed from the same correct/incorrect/missing counts
 *    the model already returns, the same way the discussion room already
 *    treats verdicts as more trustworthy than free-form ratings.
 */

export type NoteEvaluation = {
  percentage: number;
  correct: { point: string; quote: string }[];
  incorrect: { point: string; quote: string; correction: string }[];
  missing: string[];
  summary: string;
};

export function buildNoteEvaluationPrompt(grounding: TopicGrounding, notes: string): string {
  const subconceptLines = grounding.subconcepts
    .map((entry) => `- ${entry.name}: ${entry.description}`)
    .join('\n');
  const factLines = grounding.facts
    .map((entry) => `- (${entry.concept}) ${entry.statement}`)
    .join('\n');

  return [
    'You are marking a secondary school student\'s revision notes on one O-Level topic.',
    '',
    'Judge ONLY against the reference material below. If the reference does not cover something',
    'the notes say, leave it out rather than judging it from your own knowledge.',
    '',
    `TOPIC: ${grounding.topicId}`,
    '',
    'KEY SUBCONCEPTS:',
    subconceptLines,
    '',
    'REFERENCE FACTS:',
    factLines,
    '',
    'STUDENT SUMMARY (generated from handwritten notes recovered by OCR and/or typed text):',
    `"""${notes.trim()}"""`,
    '',
    'Return ONLY a JSON object, no prose and no code fence, shaped exactly:',
    '{"correct":[{"point":"","quote":""}],"incorrect":[{"point":"","quote":"","correction":""}],',
    '"missing":[""],"summary":""}',
    '',
    '- correct: what the notes get right, quoting the notes.',
    '- incorrect: only claims that CONTRADICT the reference. Not omissions, not messy phrasing.',
    '- missing: reference points the notes never make.',
    '- summary: two sentences, addressed to the student as "you".',
    'If the notes are too short or off-topic to judge, say so in summary and leave the arrays empty.',
  ].join('\n');
}

/**
 * Parses the model's reply into everything except the percentage, which the
 * caller derives afterward. Deliberately the same shape and the same
 * lenient-JSON-extraction approach as explanation-analysis.ts's parseAnalysis
 * -- proven against real model replies that wrap JSON in prose or a fence.
 */
function parseVerdictFields(reply: string): Omit<NoteEvaluation, 'percentage'> | null {
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

  const value = parsed as Record<string, unknown>;
  const asArray = (input: unknown) => (Array.isArray(input) ? input : []);
  const text = (input: unknown) => (typeof input === 'string' ? input : '');

  return {
    correct: asArray(value.correct)
      .map((item) => ({
        point: text((item as Record<string, unknown>)?.point),
        quote: text((item as Record<string, unknown>)?.quote),
      }))
      .filter((item) => item.point),
    incorrect: asArray(value.incorrect)
      .map((item) => ({
        point: text((item as Record<string, unknown>)?.point),
        quote: text((item as Record<string, unknown>)?.quote),
        correction: text((item as Record<string, unknown>)?.correction),
      }))
      .filter((item) => item.point),
    missing: asArray(value.missing).map(text).filter(Boolean),
    summary: text(value.summary),
  };
}

/**
 * A coverage-and-correctness score out of the same three buckets the model
 * already judged: each correct point earns full credit, each incorrect one is
 * scored as a miss (getting it wrong is not worth more than not mentioning it),
 * and each missing reference point counts against the total. Nothing to judge
 * at all (fewer than 2 grounded points) reports 0 rather than a divide-by-zero
 * 100 -- an empty judgement is not a perfect score.
 */
export function scoreFromVerdict(verdict: Omit<NoteEvaluation, 'percentage'>): number {
  const total = verdict.correct.length + verdict.incorrect.length + verdict.missing.length;
  if (total < 2) return 0;
  return Math.round((verdict.correct.length / total) * 100);
}

export function parseNoteEvaluation(reply: string): NoteEvaluation | null {
  const fields = parseVerdictFields(reply);
  if (!fields) return null;
  return { ...fields, percentage: scoreFromVerdict(fields) };
}

export async function evaluateNotes(
  topicId: string,
  notes: string,
  model: AnalysisModel,
  loadGrounding: (topicId: string) => Promise<TopicGrounding | null> = buildTopicGrounding,
): Promise<NoteEvaluation | null> {
  // A handful of words cannot demonstrate coverage of a topic either way, and
  // asking the model anyway spends a call to be told so.
  if (notes.trim().split(/\s+/).length < 12) return null;

  const grounding = await loadGrounding(topicId);
  if (!grounding) return null;

  const reply = await model.complete(buildNoteEvaluationPrompt(grounding, notes));
  return parseNoteEvaluation(reply);
}
