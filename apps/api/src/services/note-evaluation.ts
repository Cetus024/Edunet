import { asMissingBullet, formatStudentFacingText } from '../../../../apps/web/lib/study-notes.js';
import {
  buildTopicGrounding,
  type AnalysisModel,
  type TopicGrounding,
} from './explanation-analysis.js';

/**
 * Judges Capture Hub notes against a fixed mark scheme.
 * One syllabus learning objective is one mark. Textbook sentences from
 * Supabase retrieval (or quiz-bank facts) tell the examiner what a complete
 * answer looks like. They are not extra marks.
 *
 * The percentage is never asked of the model. Extra waffle, repeated points,
 * and content outside the mark scheme cannot raise it.
 *
 * Each objective scores a fraction of 1:
 *   credit = (accurate + 0.5 ├ù partial) / points in that objective
 * Incorrect and missing points score 0. Then:
 *   percentage = (sum of credits / total learning objectives) ├ù 100
 *
 * That sits between all-or-nothing (too harsh when one sentence is incomplete)
 * and counting every textbook sentence as its own mark (too easy to farm).
 */

export type NoteCitation = {
  title: string;
  page: number | null;
  excerpt: string;
};

export type ObjectiveVerdict = 'accurate' | 'partial' | 'incorrect' | 'missing';

export type LearningObjectivePoint = {
  id: string;
  objectiveId: string;
  objectiveName: string;
  statement: string;
};

export type NoteEvaluation = {
  percentage: number;
  accurateCount: number;
  objectiveCount: number;
  formulaMarkdown: string;
  correct: { point: string; quote: string }[];
  incorrect: { point: string; quote: string; correction: string }[];
  missing: string[];
  improvements: string[];
  summary: string;
  citations: NoteCitation[];
};

export const MAX_LEARNING_POINTS = 12;
export const MAX_POINTS_PER_OBJECTIVE = 4;

function evaluationFormulaMarkdown(
  accurateCount: number,
  objectiveCount: number,
  percentage: number,
): string {
  return [
    `$$\\mathrm{Accuracy}=\\dfrac{n_{\\text{accurate}}}{N_{\\text{LO}}}\\times 100\\%=\\dfrac{${formatCount(accurateCount)}}{${objectiveCount}}\\times 100\\%=${percentage}\\%$$`,
    '',
    'Each learning objective is worth up to 1. Accurate points score fully, partial points score half, and extra waffle cannot raise the mark.',
  ].join('\n');
}

function formatCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pointCredit(verdict: string | undefined): number {
  if (verdict === 'accurate') return 1;
  if (verdict === 'partial') return 0.5;
  return 0;
}

function plainPoint(text: string): string {
  return formatStudentFacingText(text.replace(/^Incomplete:\s*/i, ''));
}

const CONTENT_WORD = /[a-z]{4,}/g;

export function splitReferenceSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 40);
}

function contentTerms(text: string): string[] {
  return (text.toLowerCase().match(CONTENT_WORD) ?? []);
}

function overlapScore(text: string, objective: { name: string; description: string }): number {
  const haystack = text.toLowerCase();
  const terms = new Set(contentTerms(`${objective.name} ${objective.description}`));
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += 1;
  }
  return score;
}

export function extractLearningObjectives(
  subconcepts: TopicGrounding['subconcepts'],
  facts: TopicGrounding['facts'],
): LearningObjectivePoint[] {
  const objectives = (subconcepts.length > 0 ? subconcepts : [{
    id: 'obj-1',
    name: 'Topic',
    description: '',
  }]).map((item, index) => ({
    id: item.id?.trim() || `obj-${index + 1}`,
    name: item.name.trim() || `Learning objective ${index + 1}`,
    description: item.description.trim(),
  }));

  const buckets = new Map<string, LearningObjectivePoint[]>(
    objectives.map((objective) => [objective.id, []]),
  );

  const assign = (objectiveId: string, objectiveName: string, statement: string) => {
    const bucket = buckets.get(objectiveId);
    const clipped = statement.replace(/\s+/g, ' ').trim();
    if (!bucket || !clipped || bucket.length >= MAX_POINTS_PER_OBJECTIVE) return;
    if (bucket.some((item) => item.statement === clipped)) return;
    bucket.push({
      id: '',
      objectiveId,
      objectiveName,
      statement: clipped,
    });
  };

  const firstObjective = objectives[0];
  if (!firstObjective) return [];

  for (const fact of facts) {
    const cleanedFact = formatStudentFacingText(fact.statement);
    const sentences = splitReferenceSentences(cleanedFact || fact.statement);
    const units = sentences.length > 0
      ? sentences
      : (cleanedFact ? [cleanedFact] : []);
    for (const statement of units) {
      let best = firstObjective;
      let bestScore = -1;
      for (const objective of objectives) {
        const score = overlapScore(`${fact.concept} ${statement}`, objective);
        if (score > bestScore) {
          best = objective;
          bestScore = score;
        }
      }
      if (bestScore <= 0) {
        best = objectives.reduce((least, objective) => {
          const leastSize = buckets.get(least.id)?.length ?? 0;
          const size = buckets.get(objective.id)?.length ?? 0;
          return size < leastSize ? objective : least;
        }, firstObjective);
      }
      assign(best.id, best.name, statement);
    }
  }

  for (const objective of objectives) {
    const bucket = buckets.get(objective.id);
    if (bucket && bucket.length === 0 && objective.description.trim()) {
      assign(objective.id, objective.name, objective.description.trim());
    }
  }

  return objectives
    .flatMap((objective) => buckets.get(objective.id) ?? [])
    .slice(0, MAX_LEARNING_POINTS)
    .map((point, index) => ({ ...point, id: `lo-${index + 1}` }));
}

export function scoreFromObjectiveVerdicts(
  points: readonly { id: string; objectiveId: string }[],
  verdicts: readonly { id: string; verdict: string }[],
): { percentage: number; accurateCount: number; objectiveCount: number } {
  const allowedIds = new Set(points.map((point) => point.id));
  const byPointId = new Map<string, string>();
  for (const item of verdicts) {
    if (!allowedIds.has(item.id) || byPointId.has(item.id)) continue;
    byPointId.set(item.id, item.verdict);
  }

  const groups = new Map<string, string[]>();
  for (const point of points) {
    const group = groups.get(point.objectiveId) ?? [];
    group.push(point.id);
    groups.set(point.objectiveId, group);
  }

  const objectiveCount = groups.size;
  if (objectiveCount === 0) {
    return { percentage: 0, accurateCount: 0, objectiveCount: 0 };
  }

  let creditSum = 0;
  for (const pointIds of groups.values()) {
    if (pointIds.length === 0) continue;
    const earned = pointIds.reduce((sum, id) => sum + pointCredit(byPointId.get(id)), 0);
    creditSum += earned / pointIds.length;
  }

  const accurateCount = round1(creditSum);
  return {
    percentage: Math.round((creditSum / objectiveCount) * 100),
    accurateCount,
    objectiveCount,
  };
}

export function buildNoteEvaluationPrompt(
  grounding: TopicGrounding,
  notes: string,
  points: readonly LearningObjectivePoint[],
): string {
  const markScheme = points
    .map((point) => `- ${point.id} [${point.objectiveName}]: ${point.statement}`)
    .join('\n');

  return [
    'You are a Cambridge O-Level examiner marking revision notes against a fixed mark scheme.',
    'Award each mark scheme point independently. The app scores each learning objective as the share of its points that are accurate; a partial answer is worth half. Extra waffle cannot raise the mark.',
    '',
    'Judge ONLY against the textbook / syllabus points below. Ignore student content that is not in the mark scheme ΓÇö extra detail cannot raise the mark.',
    'Quote the notes only as evidence. Corrections must come from the labelled point, not unstated knowledge.',
    'Never mention page numbers, figure numbers, Fig., image captions, or chapter headings. Write formulas with ordinary letters and numbers, like O2, CH4, e-, O2-.',
    '',
    `TOPIC: ${grounding.topicId}`,
    '',
    'MARK SCHEME (learning-objective points from the syllabus and textbook):',
    markScheme,
    '',
    'STUDENT SUMMARY (generated from handwritten notes recovered by OCR and/or typed text):',
    `"""${notes.trim()}"""`,
    '',
    'Return ONLY a JSON object, no prose and no code fence, shaped exactly:',
    '{"verdicts":[{"id":"lo-1","verdict":"accurate","point":"","quote":"","correction":""}],',
    '"improvements":[""],"summary":""}',
    '',
    `Include every mark scheme id (${points.map((point) => point.id).join(', ')}). No other ids.`,
    'Do not return a percentage or a mark total. The app calculates that.',
    'verdict must be one of: accurate, partial, incorrect, missing.',
    '- accurate: the notes discuss this point AND the science is complete and correct. Full credit.',
    '- For accurate, set point to one short plain sentence of what the notes got right, like "Oxidation and reduction are correctly defined in terms of electron loss and gain." No markdown.',
    '- partial: mentioned but incomplete or imprecise. Half credit.',
    '- For partial or missing, set point to one short plain sentence naming the gap, like "Definition of oxidation and reduction in terms of the gain and loss of oxygen." Start with a noun phrase such as "Definition of", "The formal definition of", "Examples of", or "The rules for". One idea. No markdown, figures, pages, or LaTeX.',
    '- incorrect: discussed but CONTRADICTS the mark scheme. No credit. Put the textbook wording in correction.',
    '- missing: not discussed. Does not score.',
    '- improvements: 3-6 next steps starting with a verb (Add, Rewrite, Define, Compare, List, Include). No page numbers, figure numbers, textbook titles, or markdown.',
    '- summary: two sentences, addressed to the student as "you".',
    'If the notes are too short or off-topic, mark every point missing and say so in summary.',
  ].join('\n');
}

function splitMissingBullets(input: unknown): string[] {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return [];
  if (value.includes(' ┬╖ ')) {
    return value.split(' ┬╖ ').map((item) => item.trim()).filter(Boolean);
  }
  return [value];
}

const VERDICTS = new Set<ObjectiveVerdict>(['accurate', 'partial', 'incorrect', 'missing']);

function asVerdict(input: unknown): ObjectiveVerdict | null {
  return typeof input === 'string' && VERDICTS.has(input as ObjectiveVerdict)
    ? input as ObjectiveVerdict
    : null;
}

type ParsedEvaluationFields = Omit<
  NoteEvaluation,
  'percentage' | 'accurateCount' | 'objectiveCount' | 'formulaMarkdown' | 'citations'
> & {
  verdicts: { id: string; verdict: ObjectiveVerdict }[];
};

function parseVerdictFields(
  reply: string,
  points: readonly LearningObjectivePoint[],
): ParsedEvaluationFields | null {
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

  const rawVerdicts = asArray(value.verdicts).map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: text(row?.id),
      verdict: asVerdict(row?.verdict),
      point: text(row?.point),
      quote: text(row?.quote),
      correction: text(row?.correction),
    };
  });

  const seen = new Set<string>();
  const correct: NoteEvaluation['correct'] = [];
  const incorrect: NoteEvaluation['incorrect'] = [];
  const missing: string[] = [];
  const verdicts: { id: string; verdict: ObjectiveVerdict }[] = [];

  for (const point of points) {
    const match = rawVerdicts.find((item) => item.id === point.id && item.verdict && !seen.has(item.id));
    const verdict = match?.verdict ?? 'missing';
    seen.add(point.id);
    verdicts.push({ id: point.id, verdict });
    if (verdict === 'accurate') {
      correct.push({
        point: plainPoint(match?.point || point.statement),
        quote: match?.quote ?? '',
      });
    } else if (verdict === 'incorrect') {
      incorrect.push({
        point: plainPoint(point.statement),
        quote: match?.quote ?? '',
        correction: plainPoint(match?.correction || point.statement),
      });
    } else if (verdict === 'partial' || verdict === 'missing') {
      const statement = asMissingBullet(match?.point || point.statement);
      if (statement) missing.push(statement);
    }
  }

  return {
    correct,
    incorrect,
    missing: missing.flatMap(splitMissingBullets).filter(Boolean),
    improvements: asArray(value.improvements).map(text).filter(Boolean),
    summary: text(value.summary),
    verdicts,
  };
}

export function buildImprovementSteps(
  verdict: Pick<NoteEvaluation, 'incorrect' | 'missing' | 'improvements'>,
): string[] {
  if (verdict.improvements.length > 0) return verdict.improvements;
  return [
    ...verdict.incorrect.map((item) => (
      item.correction
        ? `Rewrite the note on ${item.point}: ${item.correction}`
        : `Rewrite the note on ${item.point}.`
    )),
    ...verdict.missing.map((gap) => (
      gap.startsWith('Incomplete: ')
        ? `Complete this learning objective: ${gap.slice('Incomplete: '.length)}`
        : `Add this to your notes: ${gap}`
    )),
  ];
}

export function parseNoteEvaluation(
  reply: string,
  points: readonly LearningObjectivePoint[],
): NoteEvaluation | null {
  const fields = parseVerdictFields(reply, points);
  if (!fields) return null;
  const score = scoreFromObjectiveVerdicts(points, fields.verdicts);
  const { verdicts, ...feedback } = fields;
  void verdicts;
  return {
    ...feedback,
    ...score,
    formulaMarkdown: evaluationFormulaMarkdown(
      score.accurateCount,
      score.objectiveCount,
      score.percentage,
    ),
    improvements: buildImprovementSteps(fields),
    citations: [],
  };
}

export async function evaluateNotes(
  topicId: string,
  notes: string,
  model: AnalysisModel,
  loadGrounding: (topicId: string) => Promise<TopicGrounding | null> = buildTopicGrounding,
): Promise<NoteEvaluation | null> {
  if (notes.trim().split(/\s+/).length < 12) return null;

  const grounding = await loadGrounding(topicId);
  if (!grounding) return null;

  const points = extractLearningObjectives(grounding.subconcepts, grounding.facts);
  if (points.length === 0) return null;

  const reply = await model.complete(buildNoteEvaluationPrompt(grounding, notes, points), { maxTokens: 1400 });
  return parseNoteEvaluation(reply, points);
}
