import { createHash } from 'node:crypto';

import { asc, eq } from 'drizzle-orm';

import { db } from '../../../../packages/database/index.js';
import { quizQuestions, subjects, subtopics, topics } from '../../../../packages/database/schema/catalog.js';

import {
  fetchExternalBankRowByVersionId,
  fetchExternalBankRows,
  filterExternalQuestionsForMode,
  hydrateExternalQuestions,
  isExternalQuestionBankConfigured,
  parseExternalQuestionKey,
  type ExternalBankCatalog,
} from './external-question-bank.js';

export type QuizQuestionType = 'mcq' | 'fill-blank' | 'structured' | 'diagram';
export type QuizQuestionMode = 'mcq' | 'essay' | 'placement';

/** Ordered stem fragments for ISCA-style exam rendering (text + math + Storage images). */
export type QuizStemBlock =
  | { type: 'text'; value: string }
  | { type: 'math'; latex: string }
  | { type: 'image'; url: string };

/** Nested structured-question part (a / b / b(i) …) with per-part marks from the bank. */
export type QuizStructuredPart = {
  label: string;
  prompt: string;
  marks: number | null;
  visuals?: Array<{ url: string }>;
  children?: QuizStructuredPart[];
};

/** Snapshot shape stored in quiz_attempt_question.options jsonb for rich stems. */
export type QuizOptionsSnapshot = {
  choices: string[];
  stemBlocks?: QuizStemBlock[];
  optionsImageUrl?: string;
  structuredParts?: QuizStructuredPart[];
};

export interface QuizQuestion {
  questionKey: string;
  type: QuizQuestionType;
  topic: string;
  subtopic: {
    id: string;
    syllabusCode: string;
    name: string;
  } | null;
  text: string;
  correctAnswer: string | number;
  explanation: string;
  linkedConcept: string;
  bloomLevel?: 'REMEMBER' | 'UNDERSTAND' | 'APPLY' | 'ANALYZE' | 'EVALUATE' | 'CREATE';
  source?: string;
  resourceNumber?: string;
  options?: string[];
  /** ISCA-style stem blocks (text / math / images) when sourced from Question Bank. */
  stemBlocks?: QuizStemBlock[];
  /** Composite A–D options image (Question Bank composite_visual mode). */
  optionsImageUrl?: string;
  /** Nested a/b/b(i) parts for structured essays (Question Bank). */
  structuredParts?: QuizStructuredPart[];
  blankWord?: string;
  wordLimit?: number;
  maxMarks?: number;
  diagramUrl?: string;
}

export function serializeQuizOptionsSnapshot(question: QuizQuestion): string[] | QuizOptionsSnapshot | null {
  if (question.stemBlocks?.length || question.optionsImageUrl || question.structuredParts?.length) {
    return {
      choices: question.options ?? [],
      ...(question.stemBlocks?.length ? { stemBlocks: question.stemBlocks } : {}),
      ...(question.optionsImageUrl ? { optionsImageUrl: question.optionsImageUrl } : {}),
      ...(question.structuredParts?.length ? { structuredParts: question.structuredParts } : {}),
    };
  }
  return question.options ?? null;
}

export function parseQuizOptionsSnapshot(
  raw: unknown,
): Pick<QuizQuestion, 'options' | 'stemBlocks' | 'optionsImageUrl' | 'structuredParts'> {
  if (Array.isArray(raw) && raw.every((item) => typeof item === 'string')) {
    return { options: raw };
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const record = raw as QuizOptionsSnapshot;
    const hasChoices = Array.isArray(record.choices)
      && record.choices.every((item) => typeof item === 'string');
    const hasRich = Boolean(
      record.stemBlocks?.length
      || record.optionsImageUrl
      || record.structuredParts?.length,
    );
    if (hasChoices || hasRich) {
      return {
        ...(hasChoices ? { options: record.choices } : {}),
        ...(Array.isArray(record.stemBlocks) ? { stemBlocks: record.stemBlocks } : {}),
        ...(typeof record.optionsImageUrl === 'string' ? { optionsImageUrl: record.optionsImageUrl } : {}),
        ...(Array.isArray(record.structuredParts) ? { structuredParts: record.structuredParts } : {}),
      };
    }
  }
  return {};
}

export type PublicPlacementQuestion = Pick<QuizQuestion,
  'questionKey' | 'topic' | 'subtopic' | 'text' | 'source'> & {
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
      subtopic: question.subtopic,
      text: question.text,
      options: question.options,
      ...(question.source ? { source: question.source } : {}),
    };
  });
}

export const serializeSpeedQuestions = serializePlacementQuestions;

export type QuestionPoolRow = typeof quizQuestions.$inferSelect & {
  topicName: string;
  topicPosition: number;
  subtopicSyllabusCode: string | null;
  subtopicName: string | null;
};

type QuestionPool = {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  topicPosition: number;
  rows: QuestionPoolRow[];
};

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
  return `${topicId}:v2:q${String(ordinal).padStart(2, '0')}`;
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
    subtopic: row.subtopicId && row.subtopicSyllabusCode && row.subtopicName
      ? { id: row.subtopicId, syllabusCode: row.subtopicSyllabusCode, name: row.subtopicName }
      : null,
    text: row.text,
    correctAnswer,
    explanation: row.explanation,
    linkedConcept: row.linkedConcept,
    ...(row.source ? { source: row.source } : {}),
    ...(row.resourceNumber ? { resourceNumber: row.resourceNumber } : {}),
    ...(options ? { options } : {}),
    ...(row.blankWord ? { blankWord: row.blankWord } : {}),
    ...(row.wordLimit !== null ? { wordLimit: row.wordLimit } : {}),
    ...(row.maxMarks !== null ? { maxMarks: row.maxMarks } : {}),
    ...(row.diagramUrl ? { diagramUrl: row.diagramUrl } : {}),
  };
}

export function seededShuffle<T extends { id?: string; questionKey?: string }>(
  rows: readonly T[],
  seed: string,
): T[] {
  return [...rows].sort((left, right) => {
    const leftId = left.questionKey ?? left.id ?? '';
    const rightId = right.questionKey ?? right.id ?? '';
    const leftHash = createHash('sha256').update(`${seed}:${leftId}`).digest('hex');
    const rightHash = createHash('sha256').update(`${seed}:${rightId}`).digest('hex');
    return leftHash.localeCompare(rightHash) || leftId.localeCompare(rightId);
  });
}

async function loadTopicCatalog(topicId: string): Promise<(ExternalBankCatalog & {
  topicPosition: number;
}) | null> {
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

  const children = await db.select({
    id: subtopics.id,
    name: subtopics.name,
    syllabusCode: subtopics.syllabusCode,
  })
    .from(subtopics)
    .where(eq(subtopics.topicId, topicId))
    .orderBy(asc(subtopics.position), asc(subtopics.id));

  return {
    ...selectedTopic,
    subtopics: children,
  };
}

async function loadQuestionPool(topicId: string): Promise<QuestionPool | null> {
  const catalog = await loadTopicCatalog(topicId);
  if (!catalog) return null;

  const rows = await db.select({
    id: quizQuestions.id,
    topicId: quizQuestions.topicId,
    subtopicId: quizQuestions.subtopicId,
    type: quizQuestions.type,
    usage: quizQuestions.usage,
    text: quizQuestions.text,
    correctAnswer: quizQuestions.correctAnswer,
    explanation: quizQuestions.explanation,
    linkedConcept: quizQuestions.linkedConcept,
    options: quizQuestions.options,
    blankWord: quizQuestions.blankWord,
    wordLimit: quizQuestions.wordLimit,
    maxMarks: quizQuestions.maxMarks,
    source: quizQuestions.source,
    resourceNumber: quizQuestions.resourceNumber,
    diagramUrl: quizQuestions.diagramUrl,
    topicName: topics.name,
    topicPosition: topics.position,
    subtopicSyllabusCode: subtopics.syllabusCode,
    subtopicName: subtopics.name,
  })
    .from(quizQuestions)
    .innerJoin(topics, eq(topics.id, quizQuestions.topicId))
    .leftJoin(subtopics, eq(subtopics.id, quizQuestions.subtopicId))
    .where(eq(topics.subjectId, catalog.subjectId))
    .orderBy(asc(topics.position), asc(quizQuestions.id));

  return {
    subjectId: catalog.subjectId,
    subjectName: catalog.subjectName,
    topicId: catalog.topicId,
    topicName: catalog.topicName,
    topicPosition: catalog.topicPosition,
    rows,
  };
}

function candidateRows(
  rows: readonly QuestionPoolRow[],
  selectedTopicId: string,
  _selectedTopicPosition: number,
  mode: QuizQuestionMode,
  subtopicId?: string,
): QuestionPoolRow[] | null {
  if (mode === 'placement' || mode === 'mcq') {
    return rows.filter((row) => (
      row.topicId === selectedTopicId
      && row.type === 'mcq'
      && (row.usage === 'placement' || row.usage === 'both')
      && (!subtopicId || row.subtopicId === subtopicId)
    ));
  }

  if (mode === 'essay') {
    return rows.filter((row) => (
      row.topicId === selectedTopicId
      && row.type === 'structured'
      && (!subtopicId || row.subtopicId === subtopicId)
    ));
  }

  return null;
}

export function selectQuestionRows(
  rows: readonly QuestionPoolRow[],
  selectedTopicId: string,
  selectedTopicPosition: number,
  mode: QuizQuestionMode,
  seed: string,
  subtopicId?: string,
): QuestionPoolRow[] | null {
  const candidates = candidateRows(rows, selectedTopicId, selectedTopicPosition, mode, subtopicId);
  if (!candidates
    || candidates.length === 0
    || (mode === 'mcq' && candidates.length < 10)
    || (mode === 'essay' && candidates.length < 5)
    || (mode === 'placement' && candidates.length < 10)) {
    return null;
  }

  const shuffled = seededShuffle(candidates, `${seed}:${mode}`);
  return shuffled.slice(0, mode === 'essay' ? 5 : 10);
}

function selectExternalQuestions(
  questions: readonly QuizQuestion[],
  mode: QuizQuestionMode,
  seed: string,
  subtopicId?: string,
): QuizQuestion[] | null {
  const candidates = filterExternalQuestionsForMode(questions, mode)
    .filter((question) => !subtopicId || question.subtopic?.id === subtopicId);
  if (candidates.length === 0
    || (mode === 'mcq' && candidates.length < 10)
    || (mode === 'essay' && candidates.length < 5)
    || (mode === 'placement' && candidates.length < 10)) {
    return null;
  }
  return seededShuffle(candidates, `${seed}:${mode}`).slice(0, mode === 'essay' ? 5 : 10);
}

function shouldUseExternalBank(subjectName: string, mode: QuizQuestionMode): boolean {
  // Placement stays on the local authored bank (usage flags). Smart Assessment
  // Chemistry MCQ + Essay pull approved items from the Question Bank by title.
  return isExternalQuestionBankConfigured()
    && subjectName === 'Chemistry'
    && (mode === 'mcq' || mode === 'essay');
}

async function loadExternalQuestionsForTopic(topicId: string): Promise<{
  catalog: ExternalBankCatalog & { topicPosition: number };
  questions: QuizQuestion[];
} | null> {
  if (!isExternalQuestionBankConfigured()) return null;
  const catalog = await loadTopicCatalog(topicId);
  if (!catalog || catalog.subjectName !== 'Chemistry') return null;

  try {
    const rows = await fetchExternalBankRows(catalog);
    return { catalog, questions: await hydrateExternalQuestions(rows, catalog) };
  } catch (error) {
    console.error('Failed to load Chemistry questions from Question Bank; falling back to local bank.', error);
    return null;
  }
}

export async function getQuizOptions(topicId: string, subjectId: string, subtopicId?: string) {
  const catalog = await loadTopicCatalog(topicId);
  if (!catalog || catalog.subjectId !== subjectId) return null;

  if (shouldUseExternalBank(catalog.subjectName, 'mcq')) {
    const external = await loadExternalQuestionsForTopic(topicId);
    if (external) {
      const mcqCount = filterExternalQuestionsForMode(external.questions, 'mcq')
        .filter((question) => !subtopicId || question.subtopic?.id === subtopicId).length;
      const essayCount = filterExternalQuestionsForMode(external.questions, 'essay')
        .filter((question) => !subtopicId || question.subtopic?.id === subtopicId).length;
      if (mcqCount >= 10 || essayCount >= 5) {
        return {
          subjectId: catalog.subjectId,
          topicId: catalog.topicId,
          modes: {
            mcq: { available: mcqCount >= 10, questionCount: mcqCount >= 10 ? 10 : 0 },
            essay: { available: essayCount >= 5, questionCount: essayCount >= 5 ? 5 : 0 },
          },
          source: 'question-bank' as const,
        };
      }
    }
  }

  const pool = await loadQuestionPool(topicId);
  if (!pool || pool.subjectId !== subjectId) return null;

  const mcqCandidateCount = candidateRows(pool.rows, pool.topicId, pool.topicPosition, 'mcq', subtopicId)?.length ?? 0;
  const essayCandidateCount = candidateRows(pool.rows, pool.topicId, pool.topicPosition, 'essay', subtopicId)?.length ?? 0;

  return {
    subjectId: pool.subjectId,
    topicId: pool.topicId,
    modes: {
      mcq: { available: mcqCandidateCount >= 10, questionCount: mcqCandidateCount >= 10 ? 10 : 0 },
      essay: { available: essayCandidateCount >= 5, questionCount: essayCandidateCount >= 5 ? 5 : 0 },
    },
    source: 'local' as const,
  };
}

export async function getKeyedQuestions(
  topicId: string,
  mode: QuizQuestionMode,
  seed: string,
  subtopicId?: string,
): Promise<{ subjectId: string; topicId: string; questions: QuizQuestion[] } | null> {
  const catalog = await loadTopicCatalog(topicId);
  if (!catalog) return null;

  if (shouldUseExternalBank(catalog.subjectName, mode)) {
    const external = await loadExternalQuestionsForTopic(topicId);
    const selected = external
      ? selectExternalQuestions(external.questions, mode, seed, subtopicId)
      : null;
    if (selected) {
      return {
        subjectId: catalog.subjectId,
        topicId: catalog.topicId,
        questions: selected,
      };
    }
  }

  const pool = await loadQuestionPool(topicId);
  if (!pool) return null;

  const selected = selectQuestionRows(pool.rows, pool.topicId, pool.topicPosition, mode, seed, subtopicId);
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
  const catalog = await loadTopicCatalog(topicId);
  if (catalog && shouldUseExternalBank(catalog.subjectName, 'mcq')) {
    const external = await loadExternalQuestionsForTopic(topicId);
    if (external && external.questions.length > 0) {
      return external.questions;
    }
  }

  const pool = await loadQuestionPool(topicId);
  if (!pool) return [];
  return pool.rows
    .filter((row) => row.topicId === topicId)
    .map(hydrateQuestion);
}

export async function getQuestionByKey(questionKey: string): Promise<QuizQuestion | null> {
  const externalKey = parseExternalQuestionKey(questionKey);
  if (externalKey) {
    if (!isExternalQuestionBankConfigured()) return null;
    const catalog = await loadTopicCatalog(externalKey.topicId);
    if (!catalog || catalog.subjectName !== 'Chemistry') return null;
    try {
      const row = await fetchExternalBankRowByVersionId(catalog, externalKey.versionId);
      if (!row) return null;
      const [question] = await hydrateExternalQuestions([row], catalog);
      return question ?? null;
    } catch (error) {
      console.error('Failed to resolve Question Bank question key.', error);
      return null;
    }
  }

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
