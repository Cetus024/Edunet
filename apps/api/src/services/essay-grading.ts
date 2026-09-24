import { z } from 'zod';

import { ApiError } from '../errors.js';
import { generateGeminiContent, isGeminiConfigured, type GeminiPart } from './gemini.js';
import { AnalysisProviderError } from './analysis-error.js';

/** Examiner-style mark codes (GCSE / A-Level / O-Level papers). */
export const MARK_CODES = ['B', 'M', 'A'] as const;
export type EssayMarkCode = (typeof MARK_CODES)[number];

const markPointSchema = z.object({
  id: z.string().min(1).max(12),
  code: z.enum(MARK_CODES).optional(),
  earned: z.boolean(),
  marks: z.coerce.number().finite().min(0).max(5).optional().default(1),
  /** For A marks: id of the M mark this accuracy mark usually depends on (e.g. "M1"). */
  dependsOn: z.string().min(1).max(12).nullable().optional(),
  /** Student / scheme part this point belongs to (e.g. "a", "b(i)"). */
  partLabel: z.string().min(1).max(40).nullable().optional(),
  schemeSentence: z.string().min(1).max(500),
  analysis: z.string().min(1).max(500),
});

const senseBonusSchema = z.object({
  awarded: z.coerce.number().finite().min(0).max(2),
  reason: z.string().max(400).optional().default(''),
}).optional();

const partFeedbackSchema = z.object({
  label: z.string().min(1).max(40),
  verdict: z.enum(['correct', 'partial', 'incorrect', 'sense']),
  marksObtained: z.coerce.number().finite().min(0),
  maximumMarks: z.coerce.number().finite().min(0).nullable().optional(),
  feedback: z.string().min(1).max(400),
});

const gradeSchema = z.object({
  marksObtained: z.coerce.number().finite().min(0),
  maximumMarks: z.coerce.number().finite().positive(),
  verdict: z.enum(['correct', 'partial', 'incorrect', 'sense']),
  summary: z.string().max(400).optional().default(''),
  markPoints: z.array(markPointSchema).max(16).optional().default([]),
  senseBonus: senseBonusSchema,
  parts: z.array(partFeedbackSchema).max(20).optional().default([]),
});

export type EssayMarkPoint = {
  id: string;
  code: EssayMarkCode;
  earned: boolean;
  marks: number;
  dependsOn: string | null;
  partLabel: string | null;
  schemeSentence: string;
  analysis: string;
};

export type EssayPartFeedback = {
  label: string;
  verdict: 'correct' | 'partial' | 'incorrect' | 'sense';
  marksObtained: number;
  maximumMarks: number | null;
  feedback: string;
};

export type EssayGradingFeedback = {
  summary: string;
  markPoints: EssayMarkPoint[];
  senseBonus: { awarded: number; reason: string };
  parts: EssayPartFeedback[];
};

export type EssayGradeResult = {
  marksObtained: number;
  maximumMarks: number;
  /** true = full marks, false = zero, null = partial / sense credit */
  isCorrect: boolean | null;
  verdict: 'correct' | 'partial' | 'incorrect' | 'sense';
  feedback: EssayGradingFeedback;
};

export type EssayGradeInput = {
  questionText: string;
  markScheme: string;
  maximumMarks: number;
  studentAnswerRaw: string;
};

type ParsedStudentPart = {
  label: string;
  text: string;
  image?: { mimeType: string; data: string };
};

const MAX_INLINE_IMAGE_CHARS = 2_500_000;
const MAX_PROMPT_SECTION_CHARS = 12_000;
const MAX_SENSE_BONUS = 2;

function roundMarks(value: number): number {
  return Math.round(value * 100) / 100;
}

function clipSection(label: string, value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_PROMPT_SECTION_CHARS) return trimmed;
  return `${trimmed.slice(0, MAX_PROMPT_SECTION_CHARS)}\n…[${label} truncated]`;
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = /^data:([^;]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = match[1]!.trim().toLowerCase();
  const data = match[2]!.replace(/\s+/g, '');
  if (!mimeType.startsWith('image/') || data.length === 0 || data.length > MAX_INLINE_IMAGE_CHARS) {
    return null;
  }
  return { mimeType, data };
}

function parseStudentParts(raw: string): ParsedStudentPart[] {
  if (!raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [{ label: 'answer', text: raw.trim() }];
    }
    const parts: ParsedStudentPart[] = [];
    for (const [label, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'string') {
        if (value.trim()) parts.push({ label, text: value.trim() });
        continue;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const record = value as Record<string, unknown>;
      const text = typeof record.text === 'string' ? record.text.trim() : '';
      const image = typeof record.imageDataUrl === 'string'
        ? parseDataUrl(record.imageDataUrl)
        : null;
      if (!text && !image) continue;
      parts.push({
        label,
        text: text || '(image / sketch attached)',
        ...(image ? { image } : {}),
      });
    }
    return parts.length > 0 ? parts : [{ label: 'answer', text: raw.trim() || '(empty)' }];
  } catch {
    return [{ label: 'answer', text: raw.trim() || '(empty)' }];
  }
}

function verdictToIsCorrect(verdict: EssayGradeResult['verdict']): boolean | null {
  if (verdict === 'correct') return true;
  if (verdict === 'incorrect') return false;
  return null;
}

function clipFeedback(text: string, max = 320): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

/** Infer B / M / A from an id like "B1", "M2", "A1". Defaults to B. */
export function inferMarkCode(id: string, explicit?: EssayMarkCode): EssayMarkCode {
  if (explicit) return explicit;
  const letter = id.trim().charAt(0).toUpperCase();
  if (letter === 'M' || letter === 'A' || letter === 'B') return letter;
  return 'B';
}

export function parseGradeJson(reply: string): z.infer<typeof gradeSchema> {
  const cleaned = reply
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`Essay grader returned no JSON (reply length ${reply.length}).`);
  }
  return gradeSchema.parse(JSON.parse(cleaned.slice(start, end + 1)));
}

function buildGeminiParts(input: EssayGradeInput, includeImages: boolean): GeminiPart[] {
  const parts = parseStudentParts(input.studentAnswerRaw);
  const geminiParts: GeminiPart[] = [
    {
      text: [
        'You are marking a Singapore O-Level Chemistry structured / essay question.',
        'Use examiner letter codes to break down how marks are earned (like GCSE / A-Level science papers):',
        '- B (independent / basic): a correct standalone fact, definition, statement, labelled feature, or choice. No long working required. Use B1, B2, B3… for multiple independent points.',
        '- M (method): a valid method / strategy / half-equation approach / working step, even if a later slip occurs.',
        '- A (accuracy): an accurate final numerical result or correctly completed dependent conclusion. Usually depends on a preceding M mark (set dependsOn to that M id, e.g. "M1"). Do NOT award A if its required M was not earned.',
        'For explanation / theory questions, prefer B marks. For calculation / working questions, use M then A.',
        `The official maximum for THIS question is ${input.maximumMarks} — the sum of all markPoints[].marks must equal that total (do not invent extra marks).`,
        'For each mark point: say whether earned, quote the scheme sentence that earns it, and analyse the student answer in 1–2 short sentences.',
        'Be fair but strict for O-Level.',
        'IMPORTANT — sense credit:',
        '- If ZERO scheme points are earned, do NOT only stamp incorrect when the answer still shows relevant O-Level chemistry understanding.',
        '- Then award senseBonus of 0, 1, or at most 2 (capped by maximumMarks). Gibberish/blank/off-topic → 0.',
        '- senseBonus only when scheme points earned are 0.',
        'If the student attached a photo or sketch, use it as working.',
        'Return ONLY JSON with no markdown:',
        '{',
        '  "marksObtained":number,',
        '  "maximumMarks":number,',
        '  "verdict":"correct"|"partial"|"sense"|"incorrect",',
        '  "summary":"one short sentence overall",',
        '  "markPoints":[{"id":"B1","code":"B","earned":true,"marks":1,"dependsOn":null,"partLabel":"a","schemeSentence":"…","analysis":"…"},{"id":"M1","code":"M","earned":true,"marks":1,"dependsOn":null,"partLabel":"b","schemeSentence":"…","analysis":"…"},{"id":"A1","code":"A","earned":false,"marks":1,"dependsOn":"M1","partLabel":"b","schemeSentence":"…","analysis":"…"}],',
        '  "senseBonus":{"awarded":0,"reason":"…"},',
        '  "parts":[{"label":"a","verdict":"correct","marksObtained":1,"maximumMarks":1,"feedback":"…"},{"label":"b","verdict":"partial","marksObtained":1,"maximumMarks":2,"feedback":"…"}]',
        '}',
        '- marksObtained = sum of earned scheme points + senseBonus (capped at maximumMarks)',
        '- verdict: correct = full; partial = some scheme marks; sense = only senseBonus; incorrect = zero',
        '- markPoints: include every scheme point (earned and not); set partLabel to the student part (e.g. "a") when the scheme is split by parts',
        '- parts: REQUIRED — one entry per student response part label, with that part\'s marks and a short explanation',
        `Student part labels to cover in "parts": ${parts.map((part) => part.label).join(', ') || '(single answer)'}`,
        `Question stem:\n${clipSection('stem', input.questionText)}`,
        `Answer key / mark scheme:\n${clipSection('scheme', input.markScheme || '(no scheme text — mark conservatively from student response)')}`,
        'Student response parts follow.',
      ].join('\n\n'),
    },
  ];

  for (const part of parts) {
    geminiParts.push({ text: `Part ${part.label}:\n${part.text}` });
    if (includeImages && part.image) {
      geminiParts.push({
        inline_data: { mime_type: part.image.mimeType, data: part.image.data },
      });
    }
  }
  return geminiParts;
}

/**
 * Enforce A-depends-on-M, clip totals to the question maximum, and build feedback.
 * Exported for unit tests.
 */
export function normalizeGrade(
  parsed: z.infer<typeof gradeSchema>,
  maximumMarks: number,
): EssayGradeResult {
  const counters: Record<EssayMarkCode, number> = { B: 0, M: 0, A: 0 };
  let markPoints: EssayMarkPoint[] = parsed.markPoints.map((point, index) => {
    const code = inferMarkCode(point.id, point.code);
    counters[code] += 1;
    const id = point.id.trim() || `${code}${counters[code] || index + 1}`;
    return {
      id,
      code,
      earned: point.earned,
      marks: roundMarks(Math.min(Math.max(0, point.marks), 5)),
      dependsOn: point.dependsOn?.trim() || null,
      partLabel: point.partLabel?.trim() || null,
      schemeSentence: clipFeedback(point.schemeSentence, 420),
      analysis: clipFeedback(point.analysis, 420),
    };
  });

  // Default A → nearest preceding M if model omitted dependsOn.
  markPoints = markPoints.map((point, index) => {
    if (point.code !== 'A' || point.dependsOn) return point;
    for (let i = index - 1; i >= 0; i -= 1) {
      if (markPoints[i]?.code === 'M') {
        return { ...point, dependsOn: markPoints[i]!.id };
      }
    }
    return point;
  });

  // A cannot be earned without its M.
  const earnedIds = new Set(markPoints.filter((point) => point.earned).map((point) => point.id));
  markPoints = markPoints.map((point) => {
    if (point.code !== 'A' || !point.earned || !point.dependsOn) return point;
    if (earnedIds.has(point.dependsOn)) return point;
    return {
      ...point,
      earned: false,
      analysis: clipFeedback(
        `${point.analysis} Accuracy mark not awarded because method mark ${point.dependsOn} was not earned.`,
      ),
    };
  });

  // Cap the advertised scheme total to the question maximum (keep order).
  let remainingBudget = maximumMarks;
  markPoints = markPoints.map((point) => {
    const capped = roundMarks(Math.min(point.marks, Math.max(0, remainingBudget)));
    remainingBudget = roundMarks(remainingBudget - capped);
    return { ...point, marks: capped };
  });

  const schemeMarks = roundMarks(
    markPoints.reduce((sum, point) => sum + (point.earned ? point.marks : 0), 0),
  );

  let senseAwarded = roundMarks(Math.min(
    MAX_SENSE_BONUS,
    Math.max(0, parsed.senseBonus?.awarded ?? 0),
  ));
  if (schemeMarks > 0) senseAwarded = 0;
  senseAwarded = Math.min(senseAwarded, maximumMarks);

  let marksObtained = roundMarks(Math.min(maximumMarks, schemeMarks + senseAwarded));
  if (markPoints.length === 0) {
    marksObtained = roundMarks(Math.min(maximumMarks, Math.max(0, parsed.marksObtained)));
  }

  let verdict: EssayGradeResult['verdict'] = parsed.verdict;
  if (marksObtained <= 0) {
    verdict = 'incorrect';
  } else if (marksObtained >= maximumMarks) {
    verdict = 'correct';
  } else if (schemeMarks <= 0 && senseAwarded > 0) {
    verdict = 'sense';
  } else {
    verdict = 'partial';
  }

  const parts: EssayPartFeedback[] = parsed.parts.map((part) => {
    const partMax = part.maximumMarks == null
      ? null
      : roundMarks(Math.max(0, part.maximumMarks));
    let partMarks = roundMarks(Math.max(0, part.marksObtained));
    if (partMax !== null) partMarks = Math.min(partMarks, partMax);
    let partVerdict = part.verdict;
    if (partMarks <= 0 && partVerdict !== 'sense') partVerdict = 'incorrect';
    else if (partMax !== null && partMarks >= partMax) partVerdict = 'correct';
    else if (partVerdict === 'incorrect' && partMarks > 0) partVerdict = 'partial';
    return {
      label: part.label.trim(),
      verdict: partVerdict,
      marksObtained: partMarks,
      maximumMarks: partMax,
      feedback: clipFeedback(part.feedback),
    };
  });

  const summary = clipFeedback(
    parsed.summary
      || (verdict === 'correct'
        ? 'Full marks against the answer key.'
        : verdict === 'sense'
          ? 'No scheme points hit, but some credit for sensible O-Level reasoning.'
          : verdict === 'incorrect'
            ? 'No marks awarded against the answer key.'
            : 'Some marks awarded; see B / M / A mark points below.'),
  );

  return {
    marksObtained,
    maximumMarks,
    verdict,
    isCorrect: verdictToIsCorrect(verdict),
    feedback: {
      summary,
      markPoints,
      senseBonus: {
        awarded: senseAwarded,
        reason: clipFeedback(parsed.senseBonus?.reason || (senseAwarded > 0
          ? 'Credit for relevant O-Level reasoning even though scheme points were missed.'
          : '')),
      },
      parts,
    },
  };
}

/**
 * Grade one structured essay answer against the bank mark scheme via Gemini.
 * Returns marks, B/M/A breakdown, and optional sense credit.
 */
export async function gradeEssayAnswer(input: EssayGradeInput): Promise<EssayGradeResult> {
  if (!isGeminiConfigured()) {
    throw new ApiError(503, 'ESSAY_GRADING_UNAVAILABLE', 'Gemini is not configured for essay marking.');
  }

  const hasImages = parseStudentParts(input.studentAnswerRaw).some((part) => Boolean(part.image));
  const attempts: Array<{ includeImages: boolean; maxOutputTokens: number }> = [
    { includeImages: hasImages, maxOutputTokens: 4096 },
    { includeImages: false, maxOutputTokens: 4096 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const reply = await generateGeminiContent(buildGeminiParts(input, attempt.includeImages), {
        maxOutputTokens: attempt.maxOutputTokens,
        thinkingLevel: 'minimal',
        timeoutMs: 55_000,
      });
      if (!reply.trim()) {
        throw new Error('Essay grader returned empty text.');
      }
      return normalizeGrade(parseGradeJson(reply), input.maximumMarks);
    } catch (error) {
      lastError = error;
      if (error instanceof ApiError) throw error;
      continue;
    }
  }

  const error = lastError;
  const detail = error instanceof AnalysisProviderError
    ? error.reason
    : error instanceof Error
      ? error.message
      : 'unknown';
  console.error(JSON.stringify({
    level: 'error',
    scope: 'essay-grading',
    detail: detail.slice(0, 240),
  }));
  if (error instanceof AnalysisProviderError) {
    throw new ApiError(
      503,
      'ESSAY_GRADING_FAILED',
      error.reason === 'rate_limited'
        ? 'Essay marking is temporarily rate-limited. Try again in a moment.'
        : error.reason === 'incomplete_output'
          ? 'Essay marking ran out of model output. Please try finishing again.'
          : 'Essay marking failed. Please try finishing again.',
    );
  }
  throw new ApiError(503, 'ESSAY_GRADING_FAILED', 'Essay marking failed. Please try finishing again.');
}
