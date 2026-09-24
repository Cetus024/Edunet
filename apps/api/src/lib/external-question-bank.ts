import { Pool, type QueryResultRow } from 'pg';

import { postgresPoolConnection } from '../../../../packages/database/pg-pool-connection.js';

import type {
  QuizQuestion,
  QuizQuestionMode,
  QuizStemBlock,
  QuizStructuredPart,
} from './question-bank.js';

type ContentBlock = {
  type?: string;
  value?: string;
  asset_id?: string;
  latex?: string;
  items?: unknown;
  ordered?: boolean;
  rows?: unknown;
  columns?: unknown;
  cells?: unknown;
  label?: string;
};

type McqOptionItem = {
  label?: string;
  content?: string | null;
  latex?: string | null;
};

type TableOptionRow = {
  label?: string;
  cells?: unknown;
};

type StructuredPartRaw = {
  label?: string;
  prompt?: string | null;
  marks?: number | null;
  visuals?: Array<{ asset_id?: string }>;
  children?: StructuredPartRaw[];
};

type AnswerPart = {
  label?: string;
  marks_max?: number | null;
  accepted_answers?: string[] | null;
  notes?: string | null;
};

export type ExternalBankCatalog = {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  /** Empty when the EDUNETS topic has no formal Subtopics. */
  subtopics: Array<{ id: string; name: string; syllabusCode: string }>;
};

export type ExternalBankRow = {
  versionId: string;
  topicTitle: string;
  subtopicTitle: string | null;
  syllabusCode: string | null;
  content: unknown;
  options: unknown;
  answerValue: string | null;
  partsAnswer: unknown;
  explanation: string | null;
};

export type AssetUrlMap = ReadonlyMap<string, string>;

let pool: Pool | null = null;

export function isExternalQuestionBankConfigured(): boolean {
  return Boolean(process.env.QUESTION_BANK_DATABASE_URL?.trim());
}

function getPool(): Pool {
  const connectionString = process.env.QUESTION_BANK_DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('QUESTION_BANK_DATABASE_URL is not configured.');
  }
  if (!pool) {
    pool = new Pool({
      ...postgresPoolConnection(connectionString),
      max: Number(process.env.QUESTION_BANK_POOL_MAX ?? 3),
      idleTimeoutMillis: Number(process.env.QUESTION_BANK_POOL_IDLE_TIMEOUT_MILLIS ?? 30_000),
      connectionTimeoutMillis: Number(process.env.QUESTION_BANK_POOL_CONNECTION_TIMEOUT_MILLIS ?? 10_000),
      application_name: 'edunets-question-bank',
    });
    pool.on('error', () => {
      console.error('Unexpected idle Question Bank PostgreSQL connection error.');
    });
  }
  return pool;
}

function questionBankPublicBase(): { supabaseUrl: string; bucket: string } | null {
  const supabaseUrl = process.env.QUESTION_BANK_SUPABASE_URL?.trim().replace(/\/+$/, '');
  if (!supabaseUrl) return null;
  const bucket = process.env.QUESTION_BANK_QUESTIONS_BUCKET?.trim() || 'questions';
  return { supabaseUrl, bucket };
}

/** Build a public Storage URL for a question_assets.storage_path value. */
export function buildQuestionBankAssetUrl(storagePath: string): string | null {
  const config = questionBankPublicBase();
  if (!config || !storagePath.trim()) return null;
  const encoded = storagePath
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${config.supabaseUrl}/storage/v1/object/public/${config.bucket}/${encoded}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/** Strip surrounding $…$ so we can re-wrap consistently. */
function stripMathDelimiters(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('$') && trimmed.endsWith('$')) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

/** Convert bank chemistry / arrow equations into mhchem body (no delimiters). */
export function toMhchemBody(raw: string): string {
  let body = stripMathDelimiters(raw);
  if (!body) return '';
  const ceMatch = /^\\ce\{([\s\S]*)\}$/.exec(body);
  if (ceMatch) return ceMatch[1]!.trim();

  return body
    .replace(/⇌/g, '<=>')
    .replace(/→/g, '->')
    .replace(/\\rightleftharpoons/g, '<=>')
    .replace(/\\rightarrow/g, '->')
    .replace(/\\to(?![a-zA-Z])/g, '->')
    // mhchem prefers H2O over H_2O
    .replace(/_(\d+)/g, '$1')
    .replace(/\^{([^}]+)}/g, '^$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isChemistryExpression(raw: string): boolean {
  const text = stripMathDelimiters(raw);
  if (!text) return false;
  // Long English stems often embed a reaction arrow or "(aq)" mid-sentence.
  // Those must stay prose — wrapping the whole paragraph in \ce{} makes one
  // unbreakable KaTeX line that overflows the Smart Assessment card.
  if (isMostlyProse(text)) {
    return Boolean(/^\\ce\{[\s\S]*\}$/.test(text.trim()));
  }
  if (/\\ce\{/.test(text)) return true;
  if (/(?:->|→|⇌|<=>|\\rightarrow|\\rightleftharpoons|\\to(?![a-zA-Z]))/.test(text)) return true;
  if (/\((?:s|l|g|aq)\)/i.test(text)) return true;
  // Short formula / ion tokens: H2O, Fe2+, OH-, X2SO4, C10H20O — not prose, not % scores
  if (
    text.length <= 48
    && !/\\frac|\\sqrt|\\times|\\div|\\pm|\\leq|\\geq/.test(text)
    && /^(?:[A-Za-z0-9()[\]+\-^=.\s])+$/.test(text)
    && /(?:[A-Z][a-z]?\d|\d+[+\-]|[A-Z][a-z]?\^|[+\-]{1,2}$)/.test(text)
    && !/^(?:IV|III|II|I)\b/.test(text)
    && !/%$/.test(text)
  ) {
    return true;
  }
  return false;
}

/** True when the string reads as English prose rather than a lone formula. */
export function isMostlyProse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return true;
  const words = trimmed.match(/[A-Za-z]{3,}/g) ?? [];
  if (words.length >= 6) return true;
  // Sentence punctuation mid-string is a strong prose signal.
  if (/[.!?].*\s+[A-Za-z]/.test(trimmed)) return true;
  return false;
}

/**
 * Question Bank text often keeps PDF line-wrap newlines mid-sentence.
 * Join those soft wraps into spaces so stems read normally; keep blank lines
 * and labelled reaction / list lines.
 */
export function normalizeExamProse(text: string): string {
  let value = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!value) return '';
  value = value.replace(/\n{3,}/g, '\n\n');
  value = value.replace(/\n(?!\n)/g, (_match, offset: number, full: string) => {
    const rest = full.slice(offset + 1);
    if (/^(Reaction\s+\d|[A-D][\).]|[•\-]\s|\d+[\).]\s|Part\s+)/i.test(rest)) {
      return '\n';
    }
    return ' ';
  });
  value = value.replace(/[ \t]{2,}/g, ' ');
  value = value.replace(/ *\n\n */g, '\n\n');
  // Common ozone-paper OCR: subscript O₃/O₂ became "Os"/"Oz".
  value = value
    .replace(/\bfor Os compared to\b/g, 'for O3 compared to')
    .replace(/\bfor Oz\b/g, 'for O2')
    .replace(/\bCl \+ Os\b/g, 'Cl + O3')
    .replace(/→\s*Oz\b/g, '→ O2')
    .replace(/->\s*Oz\b/g, '-> O2');
  return value.trim();
}

function wrapEmbeddedLatexCommands(text: string): string {
  return text.replace(
    /\\[a-zA-Z]+(?:\*?\{[^{}]*\})+/g,
    (match) => (match.startsWith('$') ? match : `$${match}$`),
  );
}

/** Wrap option / stem fragments for KaTeX + mhchem on the web client. */
export function formatExamKatexFragment(raw: string, preferChemistry = false): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // Prose that already embeds $…$ / \(…\) — do not re-wrap the whole string.
  if (!preferChemistry && /\$|\\\(|\\\[/.test(trimmed)) return trimmed;
  if (/\\ce\{/.test(trimmed) && /\$/.test(trimmed)) return trimmed;

  const body = stripMathDelimiters(trimmed);
  if (!body) return '';

  // Prose with embedded \ce / \frac — wrap command spans only, never the paragraph.
  if (isMostlyProse(body)) {
    if (/\\[a-zA-Z]+/.test(body)) return wrapEmbeddedLatexCommands(body);
    return trimmed;
  }

  if (/\\ce\{/.test(body)) return `$${body}$`;

  const treatAsChem = preferChemistry || isChemistryExpression(body);
  if (treatAsChem) {
    return `$\\ce{${toMhchemBody(body)}}$`;
  }
  if (/\\[a-zA-Z]+/.test(body)) return `$${body}$`;
  return trimmed;
}

function formatListBlock(block: ContentBlock): string | null {
  if (!Array.isArray(block.items)) return null;
  const items = block.items.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  if (items.length === 0) return null;
  return items
    .map((item, index) => {
      const prefix = block.ordered ? `${index + 1}.` : '•';
      return `${prefix} ${formatExamKatexFragment(normalizeExamProse(item))}`;
    })
    .join('\n');
}

function flattenContent(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content as ContentBlock[]) {
    if (!block || typeof block !== 'object') continue;
    if (block.type === 'image') continue;
    if (block.type === 'math' && typeof block.latex === 'string' && block.latex.trim()) {
      parts.push(formatExamKatexFragment(block.latex, false));
      continue;
    }
    if (block.type === 'chemistry' && typeof block.value === 'string' && block.value.trim()) {
      parts.push(formatExamKatexFragment(block.value, true));
      continue;
    }
    if (block.type === 'list') {
      const list = formatListBlock(block);
      if (list) parts.push(list);
      continue;
    }
    if (typeof block.value === 'string' && block.value.trim()) {
      const value = normalizeExamProse(block.value);
      if (!value) continue;
      parts.push(
        isChemistryExpression(value) || /\\[a-zA-Z]+/.test(value)
          ? formatExamKatexFragment(value)
          : value,
      );
    }
  }
  return parts.join('\n\n').trim();
}

export function buildStemBlocks(
  content: unknown,
  assetUrls: AssetUrlMap,
  options?: unknown,
): QuizStemBlock[] {
  const blocks: QuizStemBlock[] = [];
  if (Array.isArray(content)) {
    for (const block of content as ContentBlock[]) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'image') {
        const url = typeof block.asset_id === 'string' ? assetUrls.get(block.asset_id) : undefined;
        if (url) blocks.push({ type: 'image', url });
        continue;
      }
      if (block.type === 'math' && typeof block.latex === 'string' && block.latex.trim()) {
        blocks.push({
          type: 'math',
          latex: stripMathDelimiters(formatExamKatexFragment(block.latex, false)),
        });
        continue;
      }
      if (block.type === 'chemistry' && typeof block.value === 'string' && block.value.trim()) {
        blocks.push({ type: 'math', latex: `\\ce{${toMhchemBody(block.value)}}` });
        continue;
      }
      if (block.type === 'list') {
        const list = formatListBlock(block);
        if (list) blocks.push({ type: 'text', value: list });
        continue;
      }
      if (typeof block.value === 'string' && block.value.trim()) {
        const value = normalizeExamProse(block.value);
        if (!value) continue;
        blocks.push({
          type: 'text',
          value: isChemistryExpression(value) || /\\[a-zA-Z]+/.test(value)
            ? formatExamKatexFragment(value)
            : value,
        });
      }
    }
  }

  const optionsRecord = asRecord(options);
  if (
    blocks.length === 0
    && typeof optionsRecord?.stem === 'string'
    && optionsRecord.stem.trim()
  ) {
    const stem = normalizeExamProse(optionsRecord.stem);
    blocks.push({
      type: 'text',
      value: isChemistryExpression(stem) || /\\[a-zA-Z]+/.test(stem)
        ? formatExamKatexFragment(stem)
        : stem,
    });
  }

  return blocks;
}

function collectAssetIds(...values: unknown[]): string[] {
  const ids = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    const record = asRecord(node);
    if (!record) return;
    if (typeof record.asset_id === 'string' && record.asset_id.trim()) {
      ids.add(record.asset_id.trim());
    }
    for (const value of Object.values(record)) visit(value);
  };
  for (const value of values) visit(value);
  return [...ids];
}

export async function resolveAssetUrls(assetIds: readonly string[]): Promise<AssetUrlMap> {
  const map = new Map<string, string>();
  if (assetIds.length === 0 || !questionBankPublicBase()) return map;

  const result = await getPool().query<{ id: string; storage_path: string }>(
    `SELECT id::text AS id, storage_path
     FROM question_assets
     WHERE id = ANY ($1::uuid[])`,
    [assetIds],
  );

  for (const row of result.rows) {
    const url = buildQuestionBankAssetUrl(row.storage_path);
    if (url) map.set(row.id, url);
  }
  return map;
}

function letterToIndex(letter: string): number | null {
  const normalized = letter.trim().toUpperCase();
  if (!/^[A-Z]$/.test(normalized)) return null;
  return normalized.charCodeAt(0) - 65;
}

function mapMcqOptions(options: unknown): { texts: string[]; labels: string[] } | null {
  const record = asRecord(options);
  if (!record) return null;
  const mode = typeof record.mode === 'string' ? record.mode : '';
  if (mode !== 'text' && mode !== 'math' && mode !== 'mixed') return null;

  const items = Array.isArray(record.items) ? record.items as McqOptionItem[] : null;
  if (!items || items.length < 2) return null;

  const texts: string[] = [];
  const labels: string[] = [];
  for (const item of items) {
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const content = typeof item.content === 'string' && item.content.trim()
      ? item.content.trim()
      : '';
    const latex = typeof item.latex === 'string' && item.latex.trim()
      ? item.latex.trim()
      : '';
    const preferChem = mode === 'math' || mode === 'mixed' || Boolean(latex);
    const text = latex
      ? formatExamKatexFragment(latex, preferChem && isChemistryExpression(latex))
      : formatExamKatexFragment(content, false);
    if (!label || !text) return null;
    labels.push(label);
    texts.push(text);
  }
  return { texts, labels };
}

function mapTableOptions(options: unknown): { texts: string[]; labels: string[] } | null {
  const record = asRecord(options);
  if (!record || record.mode !== 'table') return null;
  const columns = Array.isArray(record.columns)
    ? record.columns.filter((col): col is string => typeof col === 'string')
    : [];
  const rows = Array.isArray(record.rows) ? record.rows as TableOptionRow[] : [];
  if (rows.length < 2) return null;

  const texts: string[] = [];
  const labels: string[] = [];
  for (const row of rows) {
    const label = typeof row.label === 'string' ? row.label.trim() : '';
    const cells = Array.isArray(row.cells)
      ? row.cells.filter((cell): cell is string => typeof cell === 'string' || typeof cell === 'number')
        .map((cell) => String(cell).trim())
      : [];
    if (!label || cells.length === 0) return null;
    const text = columns.length === cells.length
      ? cells.map((cell, index) => `${columns[index]}: ${formatExamKatexFragment(cell)}`).join(' · ')
      : cells.map((cell) => formatExamKatexFragment(cell)).join(' · ');
    labels.push(label);
    texts.push(text);
  }
  return { texts, labels };
}

function mapCompositeVisualOptions(
  options: unknown,
  assetUrls: AssetUrlMap,
): { labels: string[]; optionsImageUrl: string } | null {
  const record = asRecord(options);
  if (!record || record.mode !== 'composite_visual') return null;
  const assetId = typeof record.asset_id === 'string' ? record.asset_id : '';
  const url = assetId ? assetUrls.get(assetId) : undefined;
  if (!url) return null;
  const labels = Array.isArray(record.labels)
    ? record.labels.filter((label): label is string => typeof label === 'string' && label.trim().length > 0)
    : ['A', 'B', 'C', 'D'];
  if (labels.length < 2) return null;
  return { labels, optionsImageUrl: url };
}

function mapStructuredStem(options: unknown, content: unknown): string {
  const record = asRecord(options);
  const stem = typeof record?.stem === 'string' && record.stem.trim()
    ? record.stem.trim()
    : flattenContent(content);
  return stem;
}

function mapStructuredPart(
  part: StructuredPartRaw,
  assetUrls: AssetUrlMap,
): QuizStructuredPart {
  const label = typeof part.label === 'string' && part.label.trim()
    ? part.label.trim()
    : '?';
  const prompt = typeof part.prompt === 'string' ? part.prompt.trim() : '';
  const marks = typeof part.marks === 'number' && Number.isFinite(part.marks)
    ? part.marks
    : null;
  const visuals = (part.visuals ?? [])
    .map((visual) => {
      const url = typeof visual.asset_id === 'string' ? assetUrls.get(visual.asset_id) : undefined;
      return url ? { url } : null;
    })
    .filter((entry): entry is { url: string } => entry !== null);
  const children = Array.isArray(part.children)
    ? part.children.map((child) => mapStructuredPart(child, assetUrls))
    : [];

  return {
    label,
    prompt,
    marks,
    ...(visuals.length > 0 ? { visuals } : {}),
    ...(children.length > 0 ? { children } : {}),
  };
}

export function mapStructuredParts(
  options: unknown,
  assetUrls: AssetUrlMap,
): QuizStructuredPart[] {
  const record = asRecord(options);
  const parts = Array.isArray(record?.parts) ? record.parts as StructuredPartRaw[] : [];
  return parts.map((part) => mapStructuredPart(part, assetUrls));
}

function sumStructuredPartMarks(parts: readonly QuizStructuredPart[]): number {
  let total = 0;
  for (const part of parts) {
    if (typeof part.marks === 'number') total += part.marks;
    if (part.children?.length) total += sumStructuredPartMarks(part.children);
  }
  return total;
}

function mapStructuredMarking(
  partsAnswer: unknown,
  explanation: string | null,
  options: unknown,
  structuredParts: readonly QuizStructuredPart[],
): {
  guide: string;
  maxMarks: number;
} {
  const record = asRecord(options);
  const declaredTotal = typeof record?.marksTotal === 'number' && Number.isFinite(record.marksTotal)
    ? record.marksTotal
    : null;

  const parts = Array.isArray(partsAnswer) ? partsAnswer as AnswerPart[] : [];
  let answerMarks = 0;
  const lines: string[] = [];

  for (const part of parts) {
    const label = typeof part.label === 'string' ? part.label : '?';
    const marks = typeof part.marks_max === 'number' && Number.isFinite(part.marks_max)
      ? part.marks_max
      : 0;
    answerMarks += marks;
    const answers = Array.isArray(part.accepted_answers)
      ? part.accepted_answers.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const notes = typeof part.notes === 'string' && part.notes.trim() ? part.notes.trim() : '';
    const answerText = answers.length > 0 ? answers.join(' / ') : notes;
    if (answerText) {
      lines.push(`(${label}) [${marks} mark${marks === 1 ? '' : 's'}] ${answerText}`);
    }
  }

  const partMarks = sumStructuredPartMarks(structuredParts);
  const maxMarks = declaredTotal && declaredTotal > 0
    ? declaredTotal
    : answerMarks > 0
      ? answerMarks
      : partMarks > 0
        ? partMarks
        : 10;

  const guide = lines.length > 0
    ? lines.join('\n')
    : (explanation?.trim() || 'See marking guide.');
  return { guide, maxMarks };
}

export function mapExternalBankRow(
  row: ExternalBankRow,
  catalog: ExternalBankCatalog,
  assetUrls: AssetUrlMap = new Map(),
): QuizQuestion | null {
  const optionsRecord = asRecord(row.options);
  const mode = typeof optionsRecord?.mode === 'string' ? optionsRecord.mode : '';

  const matchedSubtopic = row.subtopicTitle
    ? catalog.subtopics.find((child) => child.name === row.subtopicTitle) ?? null
    : null;

  if (catalog.subtopics.length > 0 && !matchedSubtopic) return null;
  if (catalog.subtopics.length === 0 && row.subtopicTitle) return null;
  if (row.topicTitle !== catalog.topicName) return null;

  const questionKey = `${catalog.topicId}:qb:${row.versionId}`;
  const linkedConcept = matchedSubtopic?.name ?? catalog.topicName;
  const subtopic = matchedSubtopic
    ? {
        id: matchedSubtopic.id,
        syllabusCode: matchedSubtopic.syllabusCode || row.syllabusCode || '',
        name: matchedSubtopic.name,
      }
    : null;

  const stemBlocks = buildStemBlocks(row.content, assetUrls, row.options);
  const plainText = flattenContent(row.content)
    || (typeof optionsRecord?.stem === 'string' ? optionsRecord.stem.trim() : '');

  if (mode === 'text' || mode === 'math' || mode === 'mixed' || mode === 'table') {
    const mapped = mode === 'table' ? mapTableOptions(row.options) : mapMcqOptions(row.options);
    if (!mapped) return null;
    const answerIndex = letterToIndex(row.answerValue ?? '');
    if (answerIndex === null || answerIndex < 0 || answerIndex >= mapped.texts.length) return null;
    if (!plainText && stemBlocks.length === 0) return null;

    return {
      questionKey,
      type: 'mcq',
      topic: catalog.topicName,
      subtopic,
      text: plainText || mapped.texts[answerIndex] || 'Question',
      correctAnswer: answerIndex,
      explanation: row.explanation?.trim() || mapped.labels[answerIndex] || 'Correct option.',
      linkedConcept,
      options: mapped.texts,
      ...(stemBlocks.length > 0 ? { stemBlocks } : {}),
      source: 'question-bank',
    };
  }

  if (mode === 'composite_visual') {
    const mapped = mapCompositeVisualOptions(row.options, assetUrls);
    if (!mapped) return null;
    const answerIndex = letterToIndex(row.answerValue ?? '');
    if (answerIndex === null || answerIndex < 0 || answerIndex >= mapped.labels.length) return null;
    if (!plainText && stemBlocks.length === 0) return null;
    const placeholderOptions = mapped.labels.map((label) => `Option ${label}`);

    return {
      questionKey,
      type: 'mcq',
      topic: catalog.topicName,
      subtopic,
      text: plainText || 'Select the correct option.',
      correctAnswer: answerIndex,
      explanation: row.explanation?.trim() || `Correct option: ${mapped.labels[answerIndex]}`,
      linkedConcept,
      options: placeholderOptions,
      optionsImageUrl: mapped.optionsImageUrl,
      ...(stemBlocks.length > 0 ? { stemBlocks } : {}),
      source: 'question-bank',
    };
  }

  if (mode === 'structured') {
    const text = mapStructuredStem(row.options, row.content);
    const structuredParts = mapStructuredParts(row.options, assetUrls);
    if (!text && stemBlocks.length === 0 && structuredParts.length === 0) return null;
    const { guide, maxMarks } = mapStructuredMarking(
      row.partsAnswer,
      row.explanation,
      row.options,
      structuredParts,
    );

    return {
      questionKey,
      type: 'structured',
      topic: catalog.topicName,
      subtopic,
      text: text || plainText || 'Structured question',
      correctAnswer: guide,
      explanation: guide,
      linkedConcept,
      maxMarks,
      wordLimit: 250,
      ...(stemBlocks.length > 0 ? { stemBlocks } : {}),
      ...(structuredParts.length > 0 ? { structuredParts } : {}),
      source: 'question-bank',
    };
  }

  return null;
}

function parseExternalRow(row: QueryResultRow): ExternalBankRow {
  return {
    versionId: String(row.version_id),
    topicTitle: String(row.topic_title),
    subtopicTitle: row.subtopic_title == null ? null : String(row.subtopic_title),
    syllabusCode: row.syllabus_code == null ? null : String(row.syllabus_code),
    content: row.content,
    options: row.options,
    answerValue: row.answer_value == null ? null : String(row.answer_value),
    partsAnswer: row.parts_answer,
    explanation: row.explanation == null ? null : String(row.explanation),
  };
}

const APPROVED_CHEMISTRY_SQL = `
SELECT
  qv.id AS version_id,
  CASE
    WHEN sn.node_type::text = 'SUBTOPIC' THEN parent.title
    ELSE sn.title
  END AS topic_title,
  CASE
    WHEN sn.node_type::text = 'SUBTOPIC' THEN sn.title
    ELSE NULL
  END AS subtopic_title,
  CASE
    WHEN sn.node_type::text = 'SUBTOPIC' THEN sn.code
    ELSE NULL
  END AS syllabus_code,
  qv.content,
  qv.options,
  qa.value AS answer_value,
  qa.parts_answer,
  qa.explanation
FROM question_versions qv
INNER JOIN bank_questions bq ON bq.id = qv.question_id
INNER JOIN question_answers qa ON qa.question_version_id = qv.id
INNER JOIN question_classifications qc
  ON qc.question_version_id = qv.id AND qc.is_primary = true
INNER JOIN syllabus_nodes sn ON sn.id = qc.syllabus_node_id
LEFT JOIN syllabus_nodes parent ON parent.id = sn.parent_id
WHERE bq.subject = 'Chemistry'
  AND qv.status::text = 'APPROVED'
  AND (
    (
      $2::text[] IS NOT NULL
      AND cardinality($2::text[]) > 0
      AND sn.node_type::text = 'SUBTOPIC'
      AND parent.title = $1
      AND sn.title = ANY ($2::text[])
    )
    OR (
      ($2::text[] IS NULL OR cardinality($2::text[]) = 0)
      AND sn.node_type::text = 'TOPIC'
      AND sn.title = $1
    )
  )
`;

export async function fetchExternalBankRows(catalog: ExternalBankCatalog): Promise<ExternalBankRow[]> {
  const subtopicNames = catalog.subtopics.map((child) => child.name);
  const result = await getPool().query(APPROVED_CHEMISTRY_SQL, [
    catalog.topicName,
    subtopicNames.length > 0 ? subtopicNames : null,
  ]);
  return result.rows.map(parseExternalRow);
}

export async function fetchExternalBankRowByVersionId(
  catalog: ExternalBankCatalog,
  versionId: string,
): Promise<ExternalBankRow | null> {
  const result = await getPool().query(
    `${APPROVED_CHEMISTRY_SQL} AND qv.id = $3::uuid`,
    [
      catalog.topicName,
      catalog.subtopics.map((child) => child.name),
      versionId,
    ],
  );
  const row = result.rows[0];
  return row ? parseExternalRow(row) : null;
}

export async function hydrateExternalQuestions(
  rows: readonly ExternalBankRow[],
  catalog: ExternalBankCatalog,
): Promise<QuizQuestion[]> {
  const assetIds = collectAssetIds(
    ...rows.flatMap((row) => [row.content, row.options, row.partsAnswer]),
  );
  const assetUrls = await resolveAssetUrls(assetIds);
  const questions: QuizQuestion[] = [];
  for (const row of rows) {
    const mapped = mapExternalBankRow(row, catalog, assetUrls);
    if (mapped) questions.push(mapped);
  }
  return questions;
}

export function filterExternalQuestionsForMode(
  questions: readonly QuizQuestion[],
  mode: QuizQuestionMode,
): QuizQuestion[] {
  if (mode === 'mcq' || mode === 'placement') {
    return questions.filter((question) => question.type === 'mcq');
  }
  if (mode === 'essay') {
    return questions.filter((question) => question.type === 'structured');
  }
  return [];
}

export function parseExternalQuestionKey(questionKey: string): { topicId: string; versionId: string } | null {
  const match = /^(.+):qb:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(questionKey);
  if (!match) return null;
  return { topicId: match[1]!, versionId: match[2]! };
}
