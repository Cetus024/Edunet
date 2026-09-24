import * as Curriculum from '../../../../apps/web/lib/curriculum.js';
import { formatStudentFacingText } from '../../../../apps/web/lib/study-notes.js';
import type { AnalysisModel } from './explanation-analysis.js';
import {
  retrieveTopicPassages,
  type RetrievedPassage,
} from './reference-retrieval.js';

export const FLASHCARDS_MAX_TOKENS = 1800;
export const FLASHCARDS_MIN = 8;
export const FLASHCARDS_MAX = 12;

export const NO_TEXTBOOK_FLASHCARDS_REPLY =
  'This topic has no staff textbook in the syllabus database yet. Flashcards can only be written from ingested textbooks.';

export type Flashcard = {
  front: string;
  back: string;
};

export type FlashcardsResult = {
  cards: Flashcard[];
  grounded: boolean;
};

export type FlashcardFocus = {
  name: string;
  description?: string;
};

export function flashcardsRetrievalQuery(topicId: string, focus?: FlashcardFocus | null): string {
  const topic = Curriculum.CURRICULUM_TOPIC_BY_ID.get(topicId);
  const topicHint = topic ? `${topic.name}. ${topic.description}` : topicId;
  if (focus?.name) {
    const focusHint = focus.description?.trim()
      ? `${focus.name}. ${focus.description.trim()}`
      : focus.name;
    return `${topicHint}. Focus on subtopic: ${focusHint}. Key definitions, must-know facts, exam traps, and revision essentials for that subtopic only.`;
  }
  return `${topicHint}. Key definitions, must-know facts, exam traps, and revision essentials.`;
}

export function buildFlashcardsPrompt(
  topicId: string,
  passages: readonly RetrievedPassage[],
  focus?: FlashcardFocus | null,
): string {
  const topic = Curriculum.CURRICULUM_TOPIC_BY_ID.get(topicId);
  const topicLabel = topic ? `${topic.name} (${topic.id})` : topicId;
  const focusLine = focus?.name
    ? `SUBTOPIC FOCUS: ${focus.name}${focus.description?.trim() ? ` — ${focus.description.trim()}` : ''}`
    : null;
  const passageLines = passages.map((passage, index) => (
    `[Passage ${index + 1}: ${passage.title}]\n${passage.content.trim()}`
  )).join('\n\n');

  return [
    'You are writing O-Level revision flashcards for a Singapore secondary student.',
    'Use ONLY the TEXTBOOK PASSAGES below. Do not use outside knowledge.',
    focusLine
      ? 'Keep only the important things for the SUBTOPIC FOCUS below. Ignore passage material that is clearly about other subtopics.'
      : 'Keep only the important things students need to know for this topic: definitions, key ideas, and common exam traps.',
    'Never mention page numbers, figure numbers, Fig., diagrams by number, or chapter titles.',
    'Write formulas with ordinary letters and numbers, like O2, CH4, e-, O2-.',
    '',
    `TOPIC: ${topicLabel}`,
    ...(focusLine ? [focusLine, ''] : ['']),
    'TEXTBOOK PASSAGES:',
    passageLines,
    '',
    'Return ONLY a JSON object, no prose and no code fence, shaped exactly:',
    '{"cards":[{"front":"","back":""}]}',
    '',
    `Include ${FLASHCARDS_MIN} to ${FLASHCARDS_MAX} cards.`,
    '- front: a short question or term (one line, under 12 words).',
    '- back: the essential answer in 1-2 short sentences. No waffle.',
    '- Prefer high-value exam points over obscure detail.',
    '- Every card must be supported by the passages.',
  ].join('\n');
}

function plainCardText(text: string): string {
  return formatStudentFacingText(text.replace(/\s+/g, ' ').trim());
}

export function parseFlashcardsReply(reply: string): Flashcard[] | null {
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

  const rawCards = (parsed as { cards?: unknown }).cards;
  if (!Array.isArray(rawCards)) return null;

  const cards: Flashcard[] = [];
  for (const item of rawCards) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const front = typeof row.front === 'string' ? plainCardText(row.front) : '';
    const back = typeof row.back === 'string' ? plainCardText(row.back) : '';
    if (!front || !back) continue;
    cards.push({ front, back });
    if (cards.length >= FLASHCARDS_MAX) break;
  }

  return cards.length > 0 ? cards : null;
}

export async function generateFlashcards(
  topicId: string,
  model: AnalysisModel,
  retrieve: (topicId: string, query: string) => Promise<RetrievedPassage[]> = retrieveTopicPassages,
  focus?: FlashcardFocus | null,
): Promise<FlashcardsResult> {
  const query = flashcardsRetrievalQuery(topicId.trim(), focus);
  const passages = query ? await retrieve(topicId.trim(), query) : [];
  if (passages.length === 0) {
    return { cards: [], grounded: false };
  }

  const reply = (await model.complete(buildFlashcardsPrompt(topicId, passages, focus), {
    maxTokens: FLASHCARDS_MAX_TOKENS,
    timeoutMs: 60_000,
  })).trim();

  const cards = parseFlashcardsReply(reply);
  if (!cards) {
    return { cards: [], grounded: true };
  }

  return { cards, grounded: true };
}
