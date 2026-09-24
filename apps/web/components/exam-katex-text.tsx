'use client';

import Markdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';

import { cn } from '@/lib/utils';

function isMostlyProse(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > 80) return true;
  const words = trimmed.match(/[A-Za-z]{3,}/g) ?? [];
  if (words.length >= 6) return true;
  if (/[.!?].*\s+[A-Za-z]/.test(trimmed)) return true;
  return false;
}

/**
 * Question Bank text often keeps PDF line-wrap newlines mid-sentence.
 * Join those soft wraps so stems are readable; keep blank lines and
 * labelled reaction / list lines.
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

/**
 * Wrap bare LaTeX command spans in `$…$` so remark-math can render them inside
 * prose. Does not wrap the whole paragraph (that turned English stems into one
 * unbreakable math block — the "latex for everything" leak / overflow).
 */
function wrapBareLatexCommands(text: string): string {
  return text.replace(
    /\\[a-zA-Z]+(?:\*?\{[^{}]*\})+/g,
    (match) => `$${match}$`,
  );
}

/**
 * Older bank mapping wrapped entire English stems in `$…$` or `$\ce{…}$` when
 * the paragraph merely contained an arrow / state symbol. Unwrap those so the
 * card can wrap lines again (also helps already-snapshotted quiz attempts).
 */
function unwrapAccidentalWholeMath(text: string): string | null {
  const trimmed = text.trim();
  const ceWrapped = /^\$\\ce\{([\s\S]*)\}\$$/.exec(trimmed);
  if (ceWrapped && isMostlyProse(ceWrapped[1]!)) {
    return normalizeExamProse(ceWrapped[1]!);
  }
  if (trimmed.startsWith('$') && trimmed.endsWith('$') && trimmed.length >= 2) {
    const inner = trimmed.slice(1, -1);
    // Mixed inline math already in the stem — leave as-is.
    if (inner.includes('$')) return null;
    if (!isMostlyProse(inner)) return null;
    const cleaned = normalizeExamProse(inner);
    return /\\[a-zA-Z]+/.test(cleaned) ? wrapBareLatexCommands(cleaned) : cleaned;
  }
  return null;
}

function toMhchemInlineBody(raw: string): string {
  return raw
    .replace(/⇌/g, '<=>')
    .replace(/→/g, '->')
    .replace(/²/g, '2')
    .replace(/³/g, '3')
    .replace(/⁰/g, '0')
    .replace(/¹/g, '1')
    .replace(/⁴/g, '4')
    .replace(/⁵/g, '5')
    .replace(/⁶/g, '6')
    .replace(/⁷/g, '7')
    .replace(/⁸/g, '8')
    .replace(/⁹/g, '9')
    .replace(/⁺/g, '+')
    .replace(/⁻/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Apply a transform only to prose outside existing `$…$` / `$$…$$` spans. */
function mapOutsideMath(text: string, transform: (chunk: string) => string): string {
  const parts: string[] = [];
  let last = 0;
  const mathRe = /\$\$[\s\S]*?\$\$|\$[^$\n]*\$/g;
  let match: RegExpExecArray | null;
  while ((match = mathRe.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(transform(text.slice(last, match.index)));
    }
    parts.push(match[0]);
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    parts.push(transform(text.slice(last)));
  }
  return parts.join('');
}

/** One chem species / electron term, e.g. Cu(s), Cu2+(aq), 2e- */
const CHEM_SPECIES =
  String.raw`(?:\d+\s*)?(?:e[+\-]|[A-Z][a-z]?(?:\d+)?(?:[+\-]+)?(?:\((?:s|l|g|aq)\))?)`;
const CHEM_SIDE = String.raw`${CHEM_SPECIES}(?:\s*\+\s*${CHEM_SPECIES})*`;
const CHEM_EQUATION = new RegExp(
  `${CHEM_SIDE}\\s*(?:→|->|⇌|<=>)\\s*${CHEM_SIDE}`,
  'g',
);
/** Standalone ions / formulas with digits, charge, or state — not bare words. */
const CHEM_FORMULA_TOKEN = new RegExp(
  String.raw`(?<![A-Za-z\\])(${CHEM_SPECIES})(?![A-Za-z])`,
  'g',
);

/**
 * In mixed prose, only lift reaction equations / short formulas into KaTeX.
 * Plain English stays plain text.
 */
function liftInlineEquations(text: string): string {
  // Already fully delimited math — leave alone (avoid nesting \ce inside \ce).
  if (/^\$\$[\s\S]*\$\$$/.test(text.trim()) || /^\$[^$\n]+\$$/.test(text.trim())) {
    return text;
  }

  let next = mapOutsideMath(text, (chunk) => (
    chunk.replace(CHEM_EQUATION, (match) => {
      const trimmed = match.trim();
      const words = trimmed.match(/[A-Za-z]{4,}/g) ?? [];
      // Skip English sentences that happen to contain an arrow.
      if (words.length >= 4) return match;
      return `$\\ce{${toMhchemInlineBody(trimmed)}}$`;
    })
  ));

  next = mapOutsideMath(next, (chunk) => (
    chunk.replace(CHEM_FORMULA_TOKEN, (match, formula: string) => {
      const token = formula.trim();
      if (token.length < 3) return match;
      if (!/\d|\(|[+\-]|[²³⁰–⁹⁺⁻]/.test(token)) return match;
      if (/^(The|And|For|With|From|That|This|When|Which|Each|Only)$/i.test(token)) {
        return match;
      }
      // Avoid wrapping lone element+state that's already inside a longer ce we missed.
      return `$\\ce{${toMhchemInlineBody(token)}}$`;
    })
  ));

  return next;
}

/**
 * Prepare exam bank text for KaTeX: keep existing $ delimiters, wrap bare
 * LaTeX commands, and lift plain chemistry formulas into mhchem.
 *
 * Keep this aligned with apps/api `formatExamKatexFragment` / `isChemistryExpression`
 * so Capture Hub and Smart Assessment share the same “prose vs formula” rules.
 */
export function prepareExamKatex(text: string): string {
  const normalized = normalizeExamProse(text);
  if (!normalized) return '';

  const unwrapped = unwrapAccidentalWholeMath(normalized);
  if (unwrapped !== null) return liftInlineEquations(unwrapped);

  if (/\$|\\\(|\\\[/.test(normalized)) return normalized;

  const hasLatexCmd = /\\[a-zA-Z]+/.test(normalized);
  // Pure latex fragment with no whitespace (e.g. \ce{KClO3}) — wrap whole string.
  if (hasLatexCmd && normalized.length <= 80 && !/\s/.test(normalized)) {
    return `$${normalized}$`;
  }
  if (hasLatexCmd) {
    return wrapBareLatexCommands(normalized);
  }

  // Reaction arrows / short formula tokens only — never whole English paragraphs.
  const hasArrow = /(?:->|→|⇌|<=>)/.test(normalized);
  const looksLikeFormula = normalized.length <= 48
    && /^(?:[A-Za-z0-9()[\]+\-^=.\s])+$/.test(normalized)
    && (
      /(?:[A-Z][a-z]?\d|\d+[+\-]|[+\-]{1,2}$)/.test(normalized)
      || /\((?:s|l|g|aq)\)/i.test(normalized)
    )
    && !/%$/.test(normalized);
  if ((hasArrow && !isMostlyProse(normalized)) || looksLikeFormula) {
    return `$\\ce{${toMhchemInlineBody(normalized)}}$`;
  }

  // Mixed scheme/feedback prose: equations only, leave English alone.
  if (hasArrow || /[A-Z][a-z]?\d|\([slgaq]\)|[²³⁰–⁹⁺⁻]/.test(normalized)) {
    return liftInlineEquations(normalized);
  }
  return normalized;
}

export function ExamKatexText({
  text,
  className,
  as = 'div',
}: {
  text: string;
  className?: string;
  as?: 'div' | 'span';
}) {
  const prepared = prepareExamKatex(text);
  if (!prepared) return null;

  const Wrapper = as;
  return (
    <Wrapper
      className={cn(
        'exam-katex max-w-full overflow-x-auto text-justify hyphens-auto',
        '[&_p]:m-0 [&_p]:mb-3 [&_p]:last:mb-0 [&_p]:text-justify [&_p]:leading-[1.65] [&_p]:break-words',
        '[&_.katex]:text-[1.02em] [&_.katex-display]:my-2 [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto',
        '[&_.katex-html]:max-w-full',
        className,
      )}
    >
      <Markdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: 'ignore' }]]}
        components={{
          p: ({ children }) => (
            <p className="break-words text-justify leading-[1.65] [text-align-last:left]">
              {children}
            </p>
          ),
        }}
      >
        {prepared}
      </Markdown>
    </Wrapper>
  );
}
