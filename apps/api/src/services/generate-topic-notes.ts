import * as Curriculum from '../../../../apps/web/lib/curriculum.js';
import * as StudyNotes from '../../../../apps/web/lib/study-notes.js';
import type { AnalysisModel } from './explanation-analysis.js';
import {
  passagesToCitations,
  retrieveTopicPassages,
  type RetrievedPassage,
} from './reference-retrieval.js';
import type { NoteCitation } from './note-evaluation.js';

export const TOPIC_NOTES_MAX_TOKENS = 4000;

export const NO_TEXTBOOK_REPLY =
  'This topic has no staff textbook in the syllabus database yet. Study notes can only be written from ingested textbooks.';

export type TopicNotesResult = {
  text: string;
  citations: NoteCitation[];
  grounded: boolean;
};

export function notesRetrievalQuery(topicId: string): string {
  const topic = Curriculum.CURRICULUM_TOPIC_BY_ID.get(topicId);
  const topicHint = topic ? `${topic.name}. ${topic.description}` : topicId;
  return `${topicHint}. Key definitions, explanations, worked examples, exam questions, and revision notes.`;
}

export function buildTopicNotesPrompt(topicId: string, passages: readonly RetrievedPassage[]): string {
  const topic = Curriculum.CURRICULUM_TOPIC_BY_ID.get(topicId);
  const topicLabel = topic ? `${topic.name} (${topic.id})` : topicId;
  const passageLines = passages.map((passage, index) => (
    `[Passage ${index + 1}: ${passage.title}]\n${passage.content.trim()}`
  )).join('\n\n');

  return [
    'You are writing O-Level revision notes for a Singapore secondary student.',
    'Use ONLY the TEXTBOOK PASSAGES below. Do not use outside knowledge.',
    'Never mention page numbers, figure numbers, Fig., diagrams by number, or "as shown in Figure". Teach the chemistry, not the book layout.',
    '',
    `TOPIC: ${topicLabel}`,
    '',
    'TEXTBOOK PASSAGES:',
    passageLines,
    '',
    'TASK: Write full revision notes a student can actually study from, not a list of facts.',
    'Write GitHub-flavoured Markdown. The app renders formulas with KaTeX and mhchem.',
    'Use this exact layout:',
    `# ${topic ? topic.name : 'Study notes'}`,
    '',
    '## Overview',
    'Two or three short paragraphs that introduce the topic and why it matters in the exam.',
    '',
    '## Key definitions',
    '### Relative atomic mass, $A_r$',
    'Write 2-4 teaching sentences for each important term, with an example from the passages.',
    '',
    '## Revision notes',
    '### A method or idea from the passages',
    'Teach the content in order with full explanations. Prefer paragraphs, numbered steps, and markdown tables when comparing two quantities.',
    'Put important equations and half-equations on their own lines using mhchem, never inline and never cut off mid-sentence:',
    '$$\\ce{O2 + 4e- -> 2O^{2-}}$$',
    '',
    '## Exam reminders',
    'Explain the traps. Underline the phrase the student must not miss, like __decolourise aqueous bromine__.',
    '',
    '## Common exam questions',
    '### Q1. A short, commonly asked O-Level question',
    '**Answer:** A clear worked answer the student can learn from, using $...$ or $$...$$ where a formula is needed.',
    '### Q2. ...',
    '',
    'RULES:',
    '- Title with #, sections with ##, and sub-topics or questions with ###. Do not skip the headings.',
    '- Bold key terms with **double asterisks**. Underline exam-critical phrases with __double underscores__.',
    '- Inline math uses $A_r$, $M_r$, $\\times 100\\%$. Display math uses $$...$$ on its own lines. Chemical formulae and half-equations use $\\ce{H2O}$ / $$\\ce{O2 + 4e- -> 2O^{2-}}$$.',
    '- Every sentence must be complete. If a passage is cut off (for example "While the."), rewrite the idea as a full teaching sentence or omit it. Do not copy dangling captions.',
    '- Do not wrap the notes in a markdown code fence.',
    '- Make the notes substantial: several teaching paragraphs in Revision notes. Do not write a fact sheet.',
    '- Include 3 to 5 common exam questions, each as ### Qn. ... followed by **Answer:**. Questions stay short; answers are complete.',
    '- Every explanation and answer must be supported by the passages. Do not invent extra syllabus content.',
  ].join('\n');
}

export async function generateTopicNotes(
  topicId: string,
  model: AnalysisModel,
  retrieve: (topicId: string, query: string) => Promise<RetrievedPassage[]> = retrieveTopicPassages,
): Promise<TopicNotesResult> {
  const query = notesRetrievalQuery(topicId.trim());
  const passages = query ? await retrieve(topicId.trim(), query) : [];
  if (passages.length === 0) {
    return { text: NO_TEXTBOOK_REPLY, citations: [], grounded: false };
  }

  const reply = (await model.complete(buildTopicNotesPrompt(topicId, passages), {
    maxTokens: TOPIC_NOTES_MAX_TOKENS,
    timeoutMs: 60_000,
  })).trim();

  return {
    text: reply ? ensureTopicNotesMarkup(topicId, reply) : NO_TEXTBOOK_REPLY,
    citations: passagesToCitations(passages),
    grounded: Boolean(reply),
  };
}

export function ensureTopicNotesMarkup(topicId: string, text: string): string {
  const cleaned = StudyNotes.dropDanglingClauses(StudyNotes.stripTextbookPointers(StudyNotes.sanitiseStudyNotesMarkup(text)));
  if (!cleaned) return cleaned;
  if (/^#{1,3}\s+\S/m.test(cleaned)) return cleaned;
  const topic = Curriculum.CURRICULUM_TOPIC_BY_ID.get(topicId);
  return `# ${topic?.name ?? 'Study notes'}\n\n${cleaned}`;
}
