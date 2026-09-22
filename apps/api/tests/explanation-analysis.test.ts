import { describe, expect, it, vi } from 'vitest';

import {
  analyzeExplanation,
  buildAnalysisPrompt,
  buildTopicRubric,
  parseAnalysis,
  type AnalysisModel,
  type TopicGrounding,
} from '../src/services/explanation-analysis.js';

const GROUNDING: TopicGrounding = {
  topicId: 'chemistry-particulate-nature-matter',
  subconcepts: [
    { name: 'Kinetic Particle Theory', description: 'Particles move continuously and gain kinetic energy when heated.' },
    { name: 'Atomic Structure', description: 'Proton number identifies an element and isotopes differ in neutron number.' },
  ],
  facts: [
    { concept: 'Proton number', statement: 'Atoms of the same element have the same number of protons.' },
    { concept: 'Isotopes', statement: 'Isotopes have the same proton number but different neutron numbers.' },
  ],
};

const WELL_FORMED = JSON.stringify({
  correct: [{ point: 'Used proton number correctly', quote: 'proton number identifies the element' }],
  incorrect: [{ point: 'Isotope definition', quote: 'isotopes have different proton numbers', correction: 'Isotopes have the same proton number but different neutron numbers.' }],
  missing: ['Electronic structure'],
  summary: 'You used proton number correctly. Recheck what differs between isotopes.',
});

const fakeModel = (reply: string): AnalysisModel => ({ complete: async () => reply });

describe('buildTopicRubric', () => {
  it('uses canonical Subtopics and preserves their syllabus labels', () => {
    expect(buildTopicRubric('math-statistics-probability')).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'S1 Data handling and analysis' }),
      expect.objectContaining({ name: 'S2 Probability' }),
    ]));
  });

  it('uses local rubric facets for an intentionally unsplit Topic', () => {
    expect(buildTopicRubric('chemistry-qualitative-analysis')).toEqual([
      {
        name: 'Cation Tests',
        description: 'Cation Tests is assessed within Qualitative Analysis learning outcomes.',
      },
      {
        name: 'Anion Tests',
        description: 'Anion Tests is assessed within Qualitative Analysis learning outcomes.',
      },
      {
        name: 'Gas Tests',
        description: 'Gas Tests is assessed within Qualitative Analysis learning outcomes.',
      },
    ]);
  });
});

describe('buildAnalysisPrompt', () => {
  const prompt = buildAnalysisPrompt(GROUNDING, 'The proton number identifies the element');

  it('supplies the grounding rather than relying on the model knowing the syllabus', () => {
    expect(prompt).toContain('Proton number identifies an element');
    expect(prompt).toContain('same proton number but different neutron numbers');
    expect(prompt).toContain('Judge ONLY against the reference material below');
  });

  it('includes the transcript', () => {
    expect(prompt).toContain('The proton number identifies the element');
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
    expect(parsed?.correct[0].point).toBe('Used proton number correctly');
    expect(parsed?.incorrect[0].correction).toContain('different neutron numbers');
    expect(parsed?.missing).toEqual(['Electronic structure']);
  });

  it('reads JSON wrapped in a code fence', () => {
    expect(parseAnalysis(`\`\`\`json\n${WELL_FORMED}\n\`\`\``)?.summary).toContain('proton number correctly');
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
      missing: [null, 'Electronic structure'],
      summary: 42,
    }));
    expect(parsed?.correct).toHaveLength(1);
    expect(parsed?.incorrect).toEqual([]);
    expect(parsed?.missing).toEqual(['Electronic structure']);
    expect(parsed?.summary).toBe('');
  });
});

describe('analyzeExplanation', () => {
  it('does not call the model for a transcript too short to judge', async () => {
    const complete = vi.fn();
    const result = await analyzeExplanation('chemistry-particulate-nature-matter', 'um protons maybe', { complete });
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
      'chemistry-particulate-nature-matter',
      'atoms contain protons neutrons and electrons arranged around a tiny central nucleus',
      fakeModel('the service is currently unavailable'),
      async () => GROUNDING,
    );
    expect(result).toBeNull();
  });

  it('marks a full transcript end to end without touching the database', async () => {
    // Grounding is injected, so this suite runs offline and without
    // DATABASE_URL — the model is the only thing being exercised here.
    const result = await analyzeExplanation(
      'chemistry-particulate-nature-matter',
      'the proton number identifies the element and isotopes have different proton numbers',
      fakeModel(WELL_FORMED),
      async () => GROUNDING,
    );
    expect(result?.incorrect[0].correction).toContain('different neutron numbers');
    expect(result?.summary).toContain('proton number correctly');
  });
});
