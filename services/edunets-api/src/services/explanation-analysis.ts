import { eq } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { quizQuestions } from '../../../../database/schema/catalog.js';
import { topicRubricFacets } from '../../../../features/concept-web/content.js';

/**
 * Judges a spoken explanation against the syllabus content this project already
 * holds.
 *
 * The keyword rubric on the client answers "was this subconcept talked about".
 * It cannot answer "was what you said right", which is the half a student
 * revising actually needs. That requires a model — but a model asked to grade
 * an O-Level response from memory can invent syllabus detail, so everything it
 * judges against is supplied in the prompt: formal Subtopic descriptions (or
 * internal outcome facets for an unsplit Topic), plus the distinct explanation
 * sentences from that Topic's authored question bank.
 *
 * A whole topic's authoritative content is 1.5-2KB, so it fits in one prompt
 * and needs no retrieval layer.
 */

export type AnalysisVerdict = {
  /** Claims the student made that the grounding supports. */
  correct: { point: string; quote: string }[];
  /** Claims that contradict the grounding, each with the correction. */
  incorrect: { point: string; quote: string; correction: string }[];
  /** Grounded points the student never made. */
  missing: string[];
  summary: string;
};

export type TopicGrounding = {
  topicId: string;
  subconcepts: { name: string; description: string }[];
  facts: { concept: string; statement: string }[];
};

/** Anything that can turn a prompt into text. Keeps the provider swappable and the service testable. */
export interface AnalysisModel {
  complete(prompt: string, options?: { maxTokens?: number; timeoutMs?: number }): Promise<string>;
}

export async function buildTopicGrounding(topicId: string): Promise<TopicGrounding | null> {
  const subconcepts = topicRubricFacets[topicId];
  if (!subconcepts) return null;

  const rows = await db
    .select({ concept: quizQuestions.linkedConcept, statement: quizQuestions.explanation })
    .from(quizQuestions)
    .where(eq(quizQuestions.topicId, topicId));

  // Dedupe on the explanation sentence so repeated supporting facts do not
  // over-weight one learning outcome in the grounding prompt.
  const seen = new Set<string>();
  const facts: { concept: string; statement: string }[] = [];
  for (const row of rows) {
    const statement = row.statement.trim();
    if (!statement || seen.has(statement)) continue;
    seen.add(statement);
    facts.push({ concept: row.concept, statement });
  }

  return {
    topicId,
    subconcepts: subconcepts.map(({ name, description }) => ({ name, description })),
    facts,
  };
}

export function buildAnalysisPrompt(grounding: TopicGrounding, transcript: string): string {
  const subconceptLines = grounding.subconcepts
    .map((entry) => `- ${entry.name}: ${entry.description}`)
    .join('\n');
  const factLines = grounding.facts
    .map((entry) => `- (${entry.concept}) ${entry.statement}`)
    .join('\n');

  // The transcript comes from speech recognition, so it has no punctuation
  // discipline, drops words and mishears terms. The prompt has to say so, or
  // the model reports transcription noise as student error.
  return [
    'You are marking a secondary school student\'s spoken explanation of one O-Level topic.',
    '',
    'Judge ONLY against the reference material below. If the reference does not cover something',
    'the student said, leave it out rather than judging it from your own knowledge.',
    '',
    `TOPIC: ${grounding.topicId}`,
    '',
    'KEY SUBCONCEPTS:',
    subconceptLines,
    '',
    'REFERENCE FACTS:',
    factLines,
    '',
    'STUDENT TRANSCRIPT (speech-to-text: unpunctuated, may drop or mishear words —',
    'do not treat transcription noise as a mistake, and quote only what bears on meaning):',
    `"""${transcript.trim()}"""`,
    '',
    'Return ONLY a JSON object, no prose and no code fence, shaped exactly:',
    '{"correct":[{"point":"","quote":""}],"incorrect":[{"point":"","quote":"","correction":""}],',
    '"missing":[""],"summary":""}',
    '',
    '- correct: what the student got right, quoting their own words.',
    '- incorrect: only claims that CONTRADICT the reference. Not omissions, not clumsy wording.',
    '- missing: reference points they never made.',
    '- summary: two sentences, addressed to the student as "you".',
    'If the transcript is too short or off-topic to judge, say so in summary and leave the arrays empty.',
  ].join('\n');
}

/**
 * Parses the model's reply.
 *
 * Models wrap JSON in prose or a code fence often enough that a bare
 * JSON.parse of the whole reply is not good enough, so the outermost braces are
 * extracted first. Anything unparseable returns null and the caller falls back
 * to the deterministic rubric rather than showing the student nothing.
 */
export function parseAnalysis(reply: string): AnalysisVerdict | null {
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

export async function analyzeExplanation(
  topicId: string,
  transcript: string,
  model: AnalysisModel,
  // Injectable so the unit tests do not reach the database. Without this the
  // suite silently required DATABASE_URL and a network path to Supabase, which
  // would fail for anyone running `npm test` offline.
  loadGrounding: (topicId: string) => Promise<TopicGrounding | null> = buildTopicGrounding,
): Promise<AnalysisVerdict | null> {
  // Below roughly a sentence there is nothing to judge, and asking anyway just
  // spends a model call to be told so.
  if (transcript.trim().split(/\s+/).length < 12) return null;

  const grounding = await loadGrounding(topicId);
  if (!grounding) return null;

  const reply = await model.complete(buildAnalysisPrompt(grounding, transcript));
  return parseAnalysis(reply);
}
