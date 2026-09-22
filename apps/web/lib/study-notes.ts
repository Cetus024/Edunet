function unwrapFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

const MATH_CHUNK = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/g;

const SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻',
};

export function sanitiseStudyNotesMarkup(raw: string): string {
  return unwrapFence(raw)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:strong|b)>/gi, '**')
    .replace(/<u>/gi, '__')
    .replace(/<\/u>/gi, '__')
    .replace(/<\/?(?:em|i|p|div|span|h[1-6])\b[^>]*>/gi, '');
}

function underlineToKatex(text: string): string {
  return text.replace(/__(.+?)__/g, (_full, phrase: string) => {
    const safe = String(phrase).replace(/\\/g, '').replace(/[{}$]/g, '');
    return `$\\underline{\\text{${safe}}}$`;
  });
}

function mapScript(value: string, table: Record<string, string>): string {
  return [...value].map((character) => table[character] ?? character).join('');
}

export function latexToPlainChemistry(math: string): string {
  return math
    .replace(/\\ce\{([^}]+)\}/g, '$1')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\rightarrow/g, '→')
    .replace(/\\to\b/g, '→')
    .replace(/\\times/g, '×')
    .replace(/_\{([^}]+)\}/g, (_full, value: string) => mapScript(value, SUBSCRIPT))
    .replace(/_(\d)/g, (_full, digit: string) => SUBSCRIPT[digit] ?? digit)
    .replace(/\^\{([^}]+)\}/g, (_full, value: string) => mapScript(value, SUPERSCRIPT))
    .replace(/\^([+\-0-9]+)/g, (_full, value: string) => mapScript(value, SUPERSCRIPT))
    .replace(/\\/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drops textbook figure/page/image pointers so notes never cite a layout the student cannot see. */
export function stripTextbookPointers(text: string): string {
  return text
    .replace(/\bChapter\s+\d+\b[:.]?/gi, '')
    .replace(/\[[^\]]*(?:image|photo|diagram|picture|illustration)[^\]]*\]/gi, '')
    .replace(/\s*\((?:see\s+)?(?:figure|fig\.?|diagram|page|pp?\.?)\s*[\d.]+[a-z]?[^)]*\)/gi, '')
    .replace(/\b(?:as shown in|shown in|see|from|in)\s+(?:the\s+)?(?:figure|fig\.?|diagram)\s*[\d.]+[a-z]?\b/gi, '')
    .replace(/\b(?:figure|fig\.)\s*[\d.]+[a-z]?\b[^.!?\n]*[.!?]?/gi, '')
    .replace(/\bon\s+pages?\s+\d+(?:\s*[-–]\s*\d+)?\b/gi, '')
    .replace(/\bp\.\s*\d+\b/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:])/g, '$1')
    .replace(/\n{3,}/g, '\n\n');
}

/** Drops cut-off captions such as "While the." that textbooks leave after a figure. */
export function dropDanglingClauses(text: string): string {
  return text
    .replace(/\s+(?:while|whilst|as|see|from|in)\s+(?:the|this|that|figure|fig\.?|diagram)?\s*\./gi, '.')
    .replace(/([.!?])\s*(?:while|whilst|as|see|from)\s+(?:the|this|that)?\s*$/gim, '$1')
    .replace(/\s+\./g, '.');
}

/** Puts chemistry formulas into mhchem so KaTeX can render letters and numbers properly. */
export function normaliseHalfEquations(text: string): string {
  return text.replace(/\$([^$\n]*\\(?:text\{|rightarrow|ce\{)[^$\n]*)\$/g, (_full, body: string) => {
    const trimmed = String(body).trim();
    const ce = trimmed
      .replace(/\\ce\{([^}]+)\}/g, '$1')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\rightarrow/g, '->')
      .replace(/\\to\b/g, '->')
      .replace(/([A-Za-z])_(\d+)/g, '$1$2')
      .replace(/e\^-/g, 'e-')
      .replace(/\s+/g, ' ')
      .trim();
    if (/(?:e\^?-|->|e-)/.test(ce) || /O\^?\{?2-?\}?/.test(ce)) {
      return `\n$$\\ce{${ce}}$$\n`;
    }
    return `$\\ce{${ce}}$`;
  });
}

/** Plain letters and numbers for evaluation cards (no LaTeX, no figure captions). */
export function formatStudentFacingText(raw: string): string {
  const cleaned = dropDanglingClauses(stripTextbookPointers(sanitiseStudyNotesMarkup(raw)));
  const withPlainMath = cleaned.replace(
    /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g,
    (_full, display: string | undefined, inline: string | undefined) => (
      latexToPlainChemistry(display ?? inline ?? '')
    ),
  );
  return withPlainMath
    .replace(/\s*\|\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\W+/, '')
    .trim();
}

/** One short definition-style bullet for the Not in your notes list. */
export function asMissingBullet(raw: string): string {
  const cleaned = formatStudentFacingText(raw);
  if (!cleaned) return '';
  const sentence = cleaned.match(/^[^.!?]+[.!?]?/)?.[0]?.trim() ?? cleaned;
  const clipped = sentence.length > 180
    ? `${sentence.slice(0, 177).replace(/\s+\S*$/, '')}`
    : sentence;
  return /[.!?]$/.test(clipped) ? clipped : `${clipped}.`;
}

/** Turns Capture Hub notes into Markdown that KaTeX and react-markdown can render. */
export function prepareStudyNotesMarkdown(raw: string): string {
  const clean = dropDanglingClauses(stripTextbookPointers(sanitiseStudyNotesMarkup(raw)));
  const withEquations = normaliseHalfEquations(clean);
  const parts: string[] = [];
  const pattern = new RegExp(MATH_CHUNK.source, 'g');
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withEquations))) {
    parts.push(underlineToKatex(withEquations.slice(lastIndex, match.index)));
    parts.push(match[0]);
    lastIndex = match.index + match[0].length;
  }
  parts.push(underlineToKatex(withEquations.slice(lastIndex)));
  return parts.join('');
}
