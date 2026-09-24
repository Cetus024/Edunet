/**
 * Spidey chat security: per-user rate limits, input sanitisation, and
 * prompt-injection / jailbreak detection. Auth still happens in route middleware.
 */

export const SPIDEY_RATE_LIMIT_MAX = 20;
export const SPIDEY_RATE_LIMIT_WINDOW_MS = 60_000;
export const SPIDEY_MAX_MESSAGE_CHARS = 1_500;
export const SPIDEY_MAX_HISTORY = 8;

export const SPIDEY_SECURITY_REPLY = [
  'Nice try, but I stay in my web!',
  'I only answer questions about EduNets, the team behind it, and me (Spidey). I will not change my rules or reveal private instructions.',
  'Want help finding a feature instead?',
].join(' ');

type RateBucket = {
  hits: number[];
};

const rateBuckets = new Map<string, RateBucket>();

/** Prompt-injection / jailbreak signals in student text. */
const INJECTION_HINT = new RegExp([
  'ignore\\s+(all\\s+)?(previous|prior|above|earlier)\\s+(instructions?|rules?|prompts?)',
  'disregard\\s+(all\\s+)?(previous|prior|above)\\s+(instructions?|rules?)',
  'forget\\s+(everything|your\\s+instructions?|your\\s+rules?)',
  'you\\s+are\\s+now',
  'act\\s+as\\s+(?:if\\s+you\\s+are\\s+)?(?:dan|developer\\s+mode|jailbreak|unrestricted)',
  'jailbreak',
  'developer\\s+mode',
  'do\\s+anything\\s+now',
  'override\\s+(your\\s+)?(system|safety|rules?)',
  'reveal\\s+(your\\s+)?(system\\s+)?(prompt|instructions?|rules?)',
  'show\\s+(me\\s+)?(your\\s+)?(system\\s+)?(prompt|instructions?)',
  'print\\s+(your\\s+)?(system\\s+)?(prompt|instructions?)',
  'system\\s*prompt',
  '<\\s*/?\\s*system\\s*>',
  '\\[\\s*system\\s*\\]',
  'role\\s*[:=]\\s*system',
  '###\\s*system',
  'new\\s+persona',
  'pretend\\s+you\\s+are\\s+not\\s+spidey',
].join('|'), 'i');

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/g;

export type SpideyRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export function resetSpideyRateLimitsForTests() {
  rateBuckets.clear();
}

export function checkSpideyRateLimit(
  userId: string,
  now = Date.now(),
): SpideyRateLimitResult {
  const key = userId.trim();
  if (!key) return { allowed: false, retryAfterSeconds: 60 };

  const bucket = rateBuckets.get(key) ?? { hits: [] };
  const windowStart = now - SPIDEY_RATE_LIMIT_WINDOW_MS;
  bucket.hits = bucket.hits.filter((hit) => hit > windowStart);

  if (bucket.hits.length >= SPIDEY_RATE_LIMIT_MAX) {
    const oldest = bucket.hits[0] ?? now;
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + SPIDEY_RATE_LIMIT_WINDOW_MS - now) / 1000));
    rateBuckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds };
  }

  bucket.hits.push(now);
  rateBuckets.set(key, bucket);
  return { allowed: true };
}

/** Strip control / invisible characters and clamp length. */
export function sanitiseSpideyText(text: string, maxChars = SPIDEY_MAX_MESSAGE_CHARS): string {
  return text
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, maxChars);
}

export function looksLikePromptInjection(text: string): boolean {
  const cleaned = sanitiseSpideyText(text, 8_000);
  if (!cleaned) return false;
  return INJECTION_HINT.test(cleaned);
}

/**
 * Harden history before it reaches the model:
 * - clamp + sanitise text
 * - keep only the latest turns
 * - require the latest message to be from the student
 * - refuse prompt-injection attempts
 */
export function hardenSpideyMessages(
  messages: readonly { role: 'user' | 'assistant'; text: string }[],
): {
  ok: true;
  messages: { role: 'user' | 'assistant'; text: string }[];
} | {
  ok: false;
  reason: 'empty' | 'injection' | 'invalid_role';
} {
  const cleaned = messages
    .map((message) => ({
      role: message.role,
      text: sanitiseSpideyText(message.text),
    }))
    .filter((message) => message.text.length > 0)
    .slice(-SPIDEY_MAX_HISTORY);

  if (cleaned.length === 0) return { ok: false, reason: 'empty' };

  const latest = cleaned[cleaned.length - 1];
  if (!latest || latest.role !== 'user') {
    return { ok: false, reason: 'invalid_role' };
  }

  for (const message of cleaned) {
    if (message.role === 'user' && looksLikePromptInjection(message.text)) {
      return { ok: false, reason: 'injection' };
    }
  }

  return { ok: true, messages: cleaned };
}

export function hardenSpideyMaterials(
  materials: readonly { name: string; subject: string; topic: string }[] = [],
): { name: string; subject: string; topic: string }[] {
  return materials
    .slice(0, 12)
    .map((item) => ({
      name: sanitiseSpideyText(item.name, 160),
      subject: sanitiseSpideyText(item.subject, 64),
      topic: sanitiseSpideyText(item.topic, 160),
    }))
    .filter((item) => item.name && item.subject && item.topic)
    .filter((item) => !looksLikePromptInjection(`${item.name} ${item.subject} ${item.topic}`));
}

/** Quote student text so the model treats it as data, not instructions. */
export function wrapStudentUtterance(text: string): string {
  const safe = sanitiseSpideyText(text).replace(/]]>|<\|/g, ' ');
  return `<student_message>\n${safe}\n</student_message>`;
}

/** Drop accidental system-prompt leaks from model output. */
export function scrubSpideyOutput(text: string): string {
  return sanitiseSpideyText(text, 4_000)
    .replace(/<\/?student_message>/gi, '')
    .replace(/\bSYSTEM PROMPT\b[:\s-]*/gi, '')
    .replace(/\bEDUNETS_GUIDE\b/gi, 'EduNets features')
    .trim();
}
