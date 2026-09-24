import type { AnalysisModel } from './explanation-analysis.js';
import { AnalysisProviderError } from './analysis-error.js';

export const SPIDEY_HISTORY_LIMIT = 6;
export const SPIDEY_ASK_MAX_TOKENS = 280;

export const SPIDEY_OFF_TOPIC_REPLY =
  "Sorry — I'm only able to answer questions about EduNets platform features. Ask me about Revision Hub, Notes Library, Quiz, Study Squad, or another screen in the app!";

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
  'Revision Hub: upload handwritten notes to evaluate them, generate flashcards from the textbook, or open Notes Library.',
  'Notes Library has Generated Notes (textbook-grounded by subject and topic) and Materials Library (saved uploads and evaluation summaries).',
  'Quiz practises topics. Concept Web shows how ideas link. Study Squad is group revision. Ask Teacher sends a question to a teacher.',
  'Rescue Room and Revision Room are live practice rooms. Dashboard shows progress. Profile holds account settings.',
  'For syllabus facts, point the student to Revision Hub flashcards, Generated Notes, or their saved materials — do not invent textbook content.',
].join(' ');

const BULLET_PREFIX = /^(?:[-*•]|\d+[.)])\s+/;

/** Loose topic keywords that still count as EduNets / study-platform help. */
const PLATFORM_HINT = /\b(edunets|edu\s*nets|revision\s*hub|capture\s*hub|notes?\s*library|flash\s*cards?|study\s*squad|concept\s*web|ask\s*teacher|rescue\s*room|revision\s*room|dashboard|profile|quiz|mascot|spidey|ocr|evaluat|upload|handwrit|handwriting|material|generate\s*notes?|sign\s*in|log\s*in|account|scan|photo|image|library|squad|teacher|syllabus|topic|subject)\b/i;

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

/** True when the latest student message is clearly about EduNets / the app. */
export function looksLikeEduNetsQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (PLATFORM_HINT.test(trimmed)) return true;
  // Short help-seeking with no topic still allowed — Spidey can ask what they need.
  if (/^(hi|hello|hey|help|thanks|thank you)[.!]?\s*$/i.test(trimmed)) return true;
  return false;
}

export function buildSpideyChatPrompt(
  messages: readonly SpideyChatMessage[],
  materials: readonly SpideyMaterialContext[] = [],
): string {
  const history = trimHistory(messages)
    .map((message) => `${message.role === 'user' ? 'Student' : 'Spidey'}: ${message.text}`)
    .join('\n');
  const materialLines = materials.length > 0
    ? materials.map((item) => `- ${item.name} (${item.subject} · ${item.topic})`).join('\n')
    : '- (no saved materials on this device yet)';

  return [
    'You are Spidey, a friendly study buddy inside EduNets — warm, clear, and encouraging.',
    'Talk like a helpful classmate: contractions are fine (you\'ll, that\'s, let\'s).',
    'ONLY answer questions about EduNets platform features (screens, how to use the app, saved materials listed below, and brief study tips tied to those features).',
    'If the student asks about anything else (homework answers, general trivia, unrelated chat, other apps), reply with exactly this sentence and nothing else:',
    `"${SPIDEY_OFF_TOPIC_REPLY}"`,
    'Do not invent syllabus facts from a textbook. If they need topic notes or flashcards, point them to Revision Hub Notes Library or Generate flashcards.',
    'Do not claim you can scan handwriting, mark a quiz, or email a teacher yourself — point them to the matching screen.',
    '',
    'FORMAT for on-topic answers:',
    '- One short, friendly opening sentence (at most 22 words).',
    '- Then 2 to 4 bullets. Each bullet is one line and one idea.',
    '- Stop after the bullets. No essays, headings, or sign-offs.',
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
    'Reply as above. Keep on-topic answers under 90 words.',
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
  const latestUser = [...messages].reverse().find((message) => message.role === 'user');
  if (latestUser && !looksLikeEduNetsQuestion(latestUser.text)) {
    return { text: SPIDEY_OFF_TOPIC_REPLY };
  }

  const reply = normaliseSpideyReply((await model.complete(
    buildSpideyChatPrompt(messages, input.materials ?? []),
    { maxTokens: SPIDEY_ASK_MAX_TOKENS },
  )).trim());
  if (!reply) throw new AnalysisProviderError('incomplete_output');
  return { text: reply };
}
