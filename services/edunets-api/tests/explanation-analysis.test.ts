import { describe, expect, it, vi } from 'vitest';

import {
  analyzeExplanation,
  buildAnalysisPrompt,
  parseAnalysis,
  type AnalysisModel,
  type TopicGrounding,
} from '../src/services/explanation-analysis.js';

const GROUNDING: TopicGrounding = {
  topicId: 'biology-genetics',
  subconcepts: [
    { name: 'DNA & Genes', description: 'DNA carries genetic instructions in genes.' },
    { name: 'Alleles', description: 'Different versions of the same gene.' },
  ],
  facts: [
    { concept: 'Alleles', statement: 'An allele is an alternative form of a gene.' },
    { concept: 'DNA', statement: 'DNA stores genetic information in the sequence of its bases.' },
  ],
};

const WELL_FORMED = JSON.stringify({
  correct: [{ point: 'Defined DNA correctly', quote: 'DNA stores the information' }],
  incorrect: [{ point: 'Allele definition', quote: 'an allele is a chromosome', correction: 'An allele is a form of a gene, not a chromosome.' }],
  missing: ['Punnett Squares'],
  summary: 'You had DNA right. Check what an allele actually is.',
});

const fakeModel = (reply: string): AnalysisModel => ({ complete: async () => reply });

describe('buildAnalysisPrompt', () => {
  const prompt = buildAnalysisPrompt(GROUNDING, 'DNA stores the information in the bases');

  it('supplies the grounding rather than relying on the model knowing the syllabus', () => {
    expect(prompt).toContain('DNA carries genetic instructions in genes.');
    expect(prompt).toContain('An allele is an alternative form of a gene.');
    expect(prompt).toContain('Judge ONLY against the reference material below');
  });

  it('includes the transcript', () => {
    expect(prompt).toContain('DNA stores the information in the bases');
  });

  it('warns that the transcript is speech-to-text', () => {
    // Without this the model reports dropped words and misheard terms as if the
    // student had said something wrong.
    expect(prompt).toMatch(/unpunctuated|mishear/i);
  });

  it('tells the model that incorrect means contradicted, not merely absent', () => {
    expect(prompt).toContain('CONTRADICT');
  });
});

describe('parseAnalysis', () => {
  it('reads a bare JSON reply', () => {
    const parsed = parseAnalysis(WELL_FORMED);
    expect(parsed?.correct[0].point).toBe('Defined DNA correctly');
    expect(parsed?.incorrect[0].correction).toContain('not a chromosome');
    expect(parsed?.missing).toEqual(['Punnett Squares']);
  });

  it('reads JSON wrapped in a code fence', () => {
    expect(parseAnalysis(`\`\`\`json\n${WELL_FORMED}\n\`\`\``)?.summary).toContain('You had DNA right');
  });

  it('reads JSON wrapped in prose', () => {
    expect(parseAnalysis(`Sure! Here is the result:\n${WELL_FORMED}\nHope that helps.`)?.correct)
      .toHaveLength(1);
  });

  it('returns null rather than throwing on an unparseable reply', () => {
    expect(parseAnalysis('I cannot help with that.')).toBeNull();
    expect(parseAnalysis('{ not json at all }')).toBeNull();
    expect(parseAnalysis('')).toBeNull();
  });

  it('drops malformed entries instead of surfacing blank rows to the student', () => {
    const parsed = parseAnalysis(JSON.stringify({
      correct: [{ quote: 'no point field' }, { point: 'kept', quote: 'q' }],
      incorrect: 'not an array',
      missing: [null, 'Alleles'],
      summary: 42,
    }));
    expect(parsed?.correct).toHaveLength(1);
    expect(parsed?.incorrect).toEqual([]);
    expect(parsed?.missing).toEqual(['Alleles']);
    expect(parsed?.summary).toBe('');
  });
});

describe('analyzeExplanation', () => {
  it('does not call the model for a transcript too short to judge', async () => {
    const complete = vi.fn();
    const result = await analyzeExplanation('biology-genetics', 'um DNA I think', { complete });
    expect(result).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not call the model for a topic with no grounding', async () => {
    const complete = vi.fn();
    const result = await analyzeExplanation(
      'not-a-real-topic',
      'this transcript is definitely long enough to be worth judging properly',
      { complete },
    );
    expect(result).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('returns null when the model replies with something unusable', async () => {
    // The caller falls back to the deterministic rubric, so the student still
    // sees coverage rather than an empty panel.
    const result = await analyzeExplanation(
      'biology-genetics',
      'mitosis produces two identical daughter cells and the chromosomes line up in the middle',
      fakeModel('the service is currently unavailable'),
      async () => GROUNDING,
    );
    expect(result).toBeNull();
  });

  it('marks a full transcript end to end without touching the database', async () => {
    // Grounding is injected, so this suite runs offline and without
    // DATABASE_URL — the model is the only thing being exercised here.
    const result = await analyzeExplanation(
      'biology-genetics',
      'DNA stores the information in its bases and an allele is a chromosome you inherit',
      fakeModel(WELL_FORMED),
      async () => GROUNDING,
    );
    expect(result?.incorrect[0].correction).toContain('not a chromosome');
    expect(result?.summary).toContain('You had DNA right');
  });
});
