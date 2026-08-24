import { createHash } from 'node:crypto';

import { asc, eq } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { quizQuestions, subjects, topics } from '../../../../database/schema/catalog.js';

export type QuizQuestionType = 'mcq' | 'fill-blank' | 'structured' | 'diagram';
export type QuizQuestionMode = 'past-paper' | 'concept-check' | 'speed-round' | 'placement';

export interface QuizQuestion {
  questionKey: string;
  type: QuizQuestionType;
  topic: string;
  text: string;
  correctAnswer: string | number;
  explanation: string;
  linkedConcept: string;
  source?: string;
  resourceNumber?: string;
  options?: string[];
  blankWord?: string;
  wordLimit?: number;
  diagramUrl?: string;
}

export type PublicPlacementQuestion = Pick<QuizQuestion,
  'questionKey' | 'topic' | 'text' | 'source'> & {
    type: 'mcq';
    options: string[];
  };

export function serializePlacementQuestions(questions: readonly QuizQuestion[]): PublicPlacementQuestion[] {
  return questions.map((question) => {
    if (question.type !== 'mcq' || !question.options) {
      throw new Error(`Placement question ${question.questionKey} is not a valid MCQ.`);
    }
    return {
      questionKey: question.questionKey,
      type: 'mcq',
      topic: question.topic,
      text: question.text,
      options: question.options,
      ...(question.source ? { source: question.source } : {}),
    };
  });
}

export type QuestionPoolRow = typeof quizQuestions.$inferSelect & {
  topicName: string;
  topicPosition: number;
};

type QuestionPool = {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  topicPosition: number;
  rows: QuestionPoolRow[];
};

export const PAST_PAPER_DEFINITIONS = [
  { id: 'paper-1', label: 'Practice Paper 1 (MCQ)' },
  { id: 'paper-2', label: 'Practice Paper 2 (Structured)' },
] as const;

function parseOptions(row: QuestionPoolRow): string[] | undefined {
  if (row.options === null) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(row.options);
  } catch {
    throw new Error(`Quiz question ${row.id} has invalid options JSON.`);
  }

  if (!Array.isArray(parsed) || !parsed.every((option) => typeof option === 'string')) {
    throw new Error(`Quiz question ${row.id} has invalid options.`);
  }
  return parsed;
}

export function questionKeyFromDatabaseId(id: string, topicId: string): string {
  const match = /-q(\d{3})$/.exec(id);
  if (!match || !id.startsWith(`${topicId}-q`)) {
    throw new Error(`Quiz question ${id} does not use the required topic-qNNN ID format.`);
  }

  const ordinal = Number(match[1]);
  if (!Number.isInteger(ordinal) || ordinal < 1) {
    throw new Error(`Quiz question ${id} has an invalid ordinal.`);
  }
  return `${topicId}:v1:q${String(ordinal).padStart(2, '0')}`;
}

function hydrateQuestion(row: QuestionPoolRow): QuizQuestion {
  const options = parseOptions(row);
  const numericAnswer = Number(row.correctAnswer);
  const correctAnswer = row.type === 'mcq' ? numericAnswer : row.correctAnswer;

  if (row.type === 'mcq'
    && (!options || options.length < 2 || !Number.isInteger(numericAnswer)
      || numericAnswer < 0 || numericAnswer >= options.length)) {
    throw new Error(`Quiz question ${row.id} has an invalid MCQ answer.`);
  }

  return {
    questionKey: questionKeyFromDatabaseId(row.id, row.topicId),
    type: row.type,
    topic: row.topicName,
    text: row.text,
    correctAnswer,
    explanation: row.explanation,
    linkedConcept: row.linkedConcept,
    ...(row.source ? { source: row.source } : {}),
    ...(row.resourceNumber ? { resourceNumber: row.resourceNumber } : {}),
    ...(options ? { options } : {}),
    ...(row.blankWord ? { blankWord: row.blankWord } : {}),
    ...(row.wordLimit !== null ? { wordLimit: row.wordLimit } : {}),
    ...(row.diagramUrl ? { diagramUrl: row.diagramUrl } : {}),
  };
}

export function seededShuffle<T extends { id: string }>(rows: readonly T[], seed: string): T[] {
  return [...rows].sort((left, right) => {
    const leftHash = createHash('sha256').update(`${seed}:${left.id}`).digest('hex');
    const rightHash = createHash('sha256').update(`${seed}:${right.id}`).digest('hex');
    return leftHash.localeCompare(rightHash) || left.id.localeCompare(right.id);
  });
}

async function loadQuestionPool(topicId: string): Promise<QuestionPool | null> {
  const [selectedTopic] = await db.select({
    topicId: topics.id,
    topicName: topics.name,
    topicPosition: topics.position,
    subjectId: subjects.id,
    subjectName: subjects.name,
  })
    .from(topics)
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(eq(topics.id, topicId))
    .limit(1);

  if (!selectedTopic) return null;

  const rows = await db.select({
    id: quizQuestions.id,
    topicId: quizQuestions.topicId,
    type: quizQuestions.type,
    usage: quizQuestions.usage,
    text: quizQuestions.text,
    correctAnswer: quizQuestions.correctAnswer,
    explanation: quizQuestions.explanation,
    linkedConcept: quizQuestions.linkedConcept,
    options: quizQuestions.options,
    blankWord: quizQuestions.blankWord,
    wordLimit: quizQuestions.wordLimit,
    source: quizQuestions.source,
    resourceNumber: quizQuestions.resourceNumber,
    diagramUrl: quizQuestions.diagramUrl,
    topicName: topics.name,
    topicPosition: topics.position,
  })
    .from(quizQuestions)
    .innerJoin(topics, eq(topics.id, quizQuestions.topicId))
    .where(eq(topics.subjectId, selectedTopic.subjectId))
    .orderBy(asc(topics.position), asc(quizQuestions.id));

  return { ...selectedTopic, rows };
}

function relatedTopicIds(rows: readonly QuestionPoolRow[], selectedTopicPosition: number): Set<string> {
  const topicPositions = new Map<string, number>();
  for (const row of rows) topicPositions.set(row.topicId, row.topicPosition);

  const nearest = [...topicPositions.entries()]
    .sort(([leftId, leftPosition], [rightId, rightPosition]) => (
      Math.abs(leftPosition - selectedTopicPosition) - Math.abs(rightPosition - selectedTopicPosition)
      || leftPosition - rightPosition
      || leftId.localeCompare(rightId)
    ))
    .slice(0, 3)
    .map(([relatedTopicId]) => relatedTopicId);

  return new Set(nearest);
}

function candidateRows(
  rows: readonly QuestionPoolRow[],
  selectedTopicId: string,
  selectedTopicPosition: number,
  mode: QuizQuestionMode,
  paperId?: string,
): QuestionPoolRow[] | null {
  if (mode === 'placement') {
    return rows.filter((row) => (
      row.topicId === selectedTopicId
      && row.type === 'mcq'
      && (row.usage === 'placement' || row.usage === 'both')
    ));
  }

  const practiceRows = rows.filter((row) => row.usage === 'practice' || row.usage === 'both');
  if (mode === 'concept-check') {
    return practiceRows.filter((row) => row.topicId === selectedTopicId);
  }

  if (mode === 'speed-round') {
    const topicIds = relatedTopicIds(practiceRows, selectedTopicPosition);
    return practiceRows.filter((row) => topicIds.has(row.topicId) && row.type === 'mcq');
  }

  if (paperId !== undefined && !PAST_PAPER_DEFINITIONS.some((paper) => paper.id === paperId)) {
    return null;
  }
  const resolvedPaperId = paperId ?? PAST_PAPER_DEFINITIONS[0].id;
  return practiceRows.filter((row) => resolvedPaperId === 'paper-1'
    ? row.type === 'mcq'
    : row.type !== 'mcq');
}

export function selectQuestionRows(
  rows: readonly QuestionPoolRow[],
  selectedTopicId: string,
  selectedTopicPosition: number,
  mode: QuizQuestionMode,
  seed: string,
  paperId?: string,
): QuestionPoolRow[] | null {
  const candidates = candidateRows(rows, selectedTopicId, selectedTopicPosition, mode, paperId);
  if (!candidates
    || candidates.length === 0
    || (mode === 'speed-round' && candidates.length < 5)
    || (mode === 'placement' && candidates.length < 10)) {
    return null;
  }

  const shuffled = seededShuffle(candidates, `${seed}:${mode}:${paperId ?? ''}`);
  if (mode === 'past-paper') return shuffled;
  return shuffled.slice(0, mode === 'placement' ? 10 : 5);
}

export async function getQuizOptions(topicId: string, subjectId: string) {
  const pool = await loadQuestionPool(topicId);
  if (!pool || pool.subjectId !== subjectId) return null;

  const conceptCount = Math.min(5, candidateRows(pool.rows, pool.topicId, pool.topicPosition, 'concept-check')?.length ?? 0);
  const speedCandidateCount = candidateRows(pool.rows, pool.topicId, pool.topicPosition, 'speed-round')?.length ?? 0;

  return {
    subjectId: pool.subjectId,
    topicId: pool.topicId,
    modes: {
      conceptCheck: { available: conceptCount > 0, questionCount: conceptCount },
      speedRound: { available: speedCandidateCount >= 5, questionCount: speedCandidateCount >= 5 ? 5 : 0 },
      pastPaper: PAST_PAPER_DEFINITIONS.map((paper) => {
        const count = candidateRows(pool.rows, pool.topicId, pool.topicPosition, 'past-paper', paper.id)?.length ?? 0;
        return { ...paper, available: count > 0, questionCount: count };
      }),
    },
  };
}

export async function getKeyedQuestions(
  topicId: string,
  mode: QuizQuestionMode,
  seed: string,
  paperId?: string,
): Promise<{ subjectId: string; topicId: string; questions: QuizQuestion[] } | null> {
  const pool = await loadQuestionPool(topicId);
  if (!pool) return null;

  const selected = selectQuestionRows(pool.rows, pool.topicId, pool.topicPosition, mode, seed, paperId);
  if (!selected) return null;

  return {
    subjectId: pool.subjectId,
    topicId: pool.topicId,
    questions: selected.map(hydrateQuestion),
  };
}

export async function getPlacementQuestions(
  topicId: string,
  subjectId: string,
  seed: string,
): Promise<{ subjectId: string; topicId: string; questions: QuizQuestion[] } | null> {
  const questionSet = await getKeyedQuestions(topicId, 'placement', seed);
  if (!questionSet || questionSet.subjectId !== subjectId || questionSet.questions.length !== 10) {
    return null;
  }
  return questionSet;
}

export async function getQuestionsForTopic(topicId: string): Promise<QuizQuestion[]> {
  const pool = await loadQuestionPool(topicId);
  if (!pool) return [];
  return pool.rows
    .filter((row) => row.topicId === topicId)
    .map(hydrateQuestion);
}

export async function getQuestionByKey(questionKey: string): Promise<QuizQuestion | null> {
  const [topicId] = questionKey.split(':');
  if (!topicId) return null;
  const questions = await getQuestionsForTopic(topicId);
  return questions.find((question) => question.questionKey === questionKey) ?? null;
}

export function gradeQuestion(question: QuizQuestion, answer: string | number): boolean {
  if (question.type === 'mcq') return answer === question.correctAnswer;
  return String(answer)
    .trim()
    .toLowerCase()
    .includes(String(question.correctAnswer).trim().toLowerCase());
}
