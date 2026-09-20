import { describe, expect, it } from 'vitest';

import { asMissingBullet, formatStudentFacingText, prepareStudyNotesMarkdown } from '../../../lib/study-notes.js';

describe('prepareStudyNotesMarkdown', () => {
  it('keeps markdown headings and lists for the renderer', () => {
    const markdown = prepareStudyNotesMarkdown([
      '# Organic Chemistry',
      '',
      '## Key definitions',
      '- **Alkene**: hydrocarbon with a C=C bond',
    ].join('\n'));

    expect(markdown).toContain('# Organic Chemistry');
    expect(markdown).toContain('## Key definitions');
    expect(markdown).toContain('- **Alkene**: hydrocarbon with a C=C bond');
  });

  it('turns exam underlines into KaTeX without touching existing formulas', () => {
    expect(prepareStudyNotesMarkdown(
      'Alkenes __decolourise aqueous bromine__ in the unsaturation test.',
    )).toContain('$\\underline{\\text{decolourise aqueous bromine}}$');

    expect(prepareStudyNotesMarkdown(
      'Relative atomic mass ($A_r$) and relative formula mass ($M_r$) do not have units.',
    )).toContain('($A_r$)');

    expect(prepareStudyNotesMarkdown(
      'Percentage purity = (mass of pure substance / total mass of impure sample) $\\times 100\\%$.',
    )).toContain('$\\times 100\\%$');
  });

  it('drops unfinished figure captions and textbook page pointers', () => {
    const markdown = prepareStudyNotesMarkdown(
      'This process can be seen more clearly in a half equation: $\\text{O}_2 + 4\\text{e}^- \\rightarrow 2\\text{O}^{2-}$ While the. See Figure 7.2 on page 361.',
    );
    expect(markdown).toContain('$\\ce{');
    expect(markdown).toContain('O2');
    expect(markdown).not.toMatch(/While the/i);
    expect(markdown).not.toMatch(/Figure 7\.2/i);
    expect(markdown).not.toMatch(/page 361/i);
  });
});

describe('formatStudentFacingText', () => {
  it('turns LaTeX chemistry into ordinary letters and numbers and drops figure captions', () => {
    const text = formatStudentFacingText([
      'Chemical Reactions | Chapter 12 Reduction: Gain of Electrons If you let iron react with oxygen gas directly, it will change from iron to iron(III) oxide eventually.',
      'This process can be seen more clearly in a half equation: $\\text{O}_2 + 4\\text{e}^- \\rightarrow 2\\text{O}^{2-}$ While the iron loses electrons, the oxygen that reacts with it gains electrons.',
      'These objects resemble their gold counterparts and can be produced at a fraction of the price (Figure 12.6).',
      '[Image of four gold-plated keychains.] Figure 12.6 Gold-plated keychains cost much less than pure gold keychains.',
      'Methane ($\\text{CH}_4$) is normally one of the fuels burnt in the gas supplied.',
    ].join(' '));

    expect(text).toContain('O₂ + 4e⁻ → 2O²⁻');
    expect(text).toContain('CH₄');
    expect(text).toContain('While the iron loses electrons');
    expect(text).not.toMatch(/Figure 12\.6/i);
    expect(text).not.toMatch(/Image of four gold-plated keychains/i);
    expect(text).not.toMatch(/Chapter 12/i);
    expect(text).not.toContain('\\text');
    expect(text).not.toContain('$');
  });

  it('keeps a definition-style missing bullet as one sentence', () => {
    expect(asMissingBullet(
      'Definition of oxidation and reduction in terms of the gain and loss of oxygen.',
    )).toBe('Definition of oxidation and reduction in terms of the gain and loss of oxygen.');
  });
});
