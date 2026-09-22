import type { AnalysisModel } from './explanation-analysis.js';
import { AnalysisProviderError } from './analysis-error.js';

export const SPIDEY_HISTORY_LIMIT = 6;
export const SPIDEY_ASK_MAX_TOKENS = 280;

export type SpideyChatMessage = {
  role: 'user' | 'assistant';
  text: string;
};

export type SpideyMaterialContext = {
  name: string;
  subject: string;
  topic: string;
};

export const EDUNETS_GUIDE = [
  'EduNets is a Singapore O-Level revision app.',
  'Capture Hub: scan handwritten notes, type notes, or generate textbook-grounded notes, then summarise and evaluate them.',
  'My Materials Library stores saved notes. Evaluation summary shows covered well, missing points, and how to improve.',
  'Quiz practises topics. Concept Web shows how ideas link. Study Squad is group revision. Ask Teacher sends a question to a teacher.',
  'Rescue Room and Revision Room are live practice rooms. Dashboard shows progress. Profile holds account settings.',
  'For syllabus facts, point the student to Capture Hub Generate Notes or their saved materials rather than inventing textbook content.',
].join(' ');

const BULLET_PREFIX = /^(?:[-*ΓÇó]|\d+[.)])\s+/;

function stripReplyMarkup(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/, '')
    .trim();
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]?/);
  return (match?.[0] ?? text).trim();
}

function splitSentences(text: string): string[] {
  return text
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map((part) => part.trim())
    .filter(Boolean) ?? (text ? [text] : []);
}

/** Keep replies short: one opener plus up to five one-line bullets. */
export function normaliseSpideyReply(raw: string): string {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => stripReplyMarkup(line))
    .filter(Boolean);

  const leftover: string[] = [];
  const bullets: string[] = [];
  for (const line of lines) {
    if (BULLET_PREFIX.test(line)) {
      const item = line.replace(BULLET_PREFIX, '').trim();
      if (item) bullets.push(item);
    } else {
      leftover.push(line);
    }
  }

  let intro = leftover.join(' ').trim();
  if (bullets.length === 0 && intro) {
    const sentences = splitSentences(intro);
    intro = sentences[0] ?? '';
    bullets.push(...sentences.slice(1));
  } else if (intro) {
    intro = firstSentence(intro);
  }

  const limited = bullets.slice(0, 5);
  return [intro, ...limited.map((item) => `- ${item}`)].filter(Boolean).join('\n');
}

export function trimHistory(messages: readonly SpideyChatMessage[]): SpideyChatMessage[] {
  return messages
    .map((message) => ({
      role: message.role,
      text: message.text.trim(),
    }))
    .filter((message) => message.text)
    .slice(-SPIDEY_HISTORY_LIMIT);
}

export function buildSpideyChatPrompt(
  messages: readonly SpideyChatMessage[],
  materials: readonly SpideyMaterialContext[] = [],
): string {
  const history = trimHistory(messages)
    .map((message) => `${message.role === 'user' ? 'Student' : 'Spidey'}: ${message.text}`)
    .join('\n');
  const materialLines = materials.length > 0
    ? materials.map((item) => `- ${item.name} (${item.subject} ┬╖ ${item.topic})`).join('\n')
    : '- (no saved materials on this device yet)';

  return [
    'You are Spidey, a study guide inside EduNets.',
    'Answer questions about EduNets features, O-Level study tips, and the student\'s saved materials listed below.',
    'Do not invent syllabus facts from a textbook. If they need topic notes, tell them to use Capture Hub Generate Notes.',
    'Do not claim you can scan handwriting, mark a quiz, or email a teacher yourself ΓÇö point them to the matching screen.',
    '',
    'FORMAT ΓÇö follow this every time:',
    '- One short opening sentence (at most 18 words).',
    '- Then 3 to 5 bullets. Each bullet is one line and one idea.',
    '- Stop after the bullets. No extra paragraphs, headings, numbered essays, greetings, or sign-offs.',
    '- Plain text only: use a hyphen and a space for bullets. No markdown, no bold, no emojis.',
    '',
    'EDUNETS FEATURES:',
    EDUNETS_GUIDE,
    '',
    'SAVED MATERIALS:',
    materialLines,
    '',
    'CONVERSATION:',
    history || 'Student: (no message)',
    '',
    'Reply in the FORMAT above. Keep the whole answer under 80 words.',
  ].join('\n');
}

export async function answerSpideyChat(
  input: {
    messages: readonly SpideyChatMessage[];
    materials?: readonly SpideyMaterialContext[];
  },
  model: AnalysisModel,
): Promise<{ text: string }> {
  const messages = trimHistory(input.messages);
  const reply = normaliseSpideyReply((await model.complete(
    buildSpideyChatPrompt(messages, input.materials ?? []),
    { maxTokens: SPIDEY_ASK_MAX_TOKENS },
  )).trim());
  if (!reply) throw new AnalysisProviderError('incomplete_output');
  return { text: reply };
}
