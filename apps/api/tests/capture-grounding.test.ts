import { describe, expect, it } from 'vitest';

import { loadCaptureGrounding } from '../src/services/capture-grounding.js';
import { passagesToCitations, passagesToFacts, retrieveTopicPassages } from '../src/services/reference-retrieval.js';
import type { TopicGrounding } from '../src/services/explanation-analysis.js';

const ORGANIC_PASSAGE = {
  title: 'Organic Chemistry — staff notes',
  page: 12,
  content: 'Alkenes are unsaturated hydrocarbons with a carbon-carbon double bond. They undergo addition reactions with hydrogen, steam and bromine.',
};

describe('passagesToFacts', () => {
  it('labels facts with title and page so the grader can cite a passage', () => {
    expect(passagesToFacts([ORGANIC_PASSAGE])).toEqual([{
      concept: 'Organic Chemistry — staff notes p.12',
      statement: ORGANIC_PASSAGE.content,
    }]);
  });
});

describe('passagesToCitations', () => {
  it('returns short excerpts rather than the full document text', () => {
    const longContent = `${ORGANIC_PASSAGE.content} ${'alkene '.repeat(120)}`;
    const [citation] = passagesToCitations([{ ...ORGANIC_PASSAGE, content: longContent }]);
    expect(citation?.title).toBe(ORGANIC_PASSAGE.title);
    expect(citation?.page).toBe(12);
    expect(citation?.excerpt.length).toBeLessThan(longContent.length);
    expect(longContent.includes(citation?.excerpt.replace(/…$/, '') ?? 'missing')).toBe(true);
  });
});

describe('loadCaptureGrounding', () => {
  it('uses retrieved textbook passages instead of the quiz-explanation fallback', async () => {
    const result = await loadCaptureGrounding(
      'chemistry-organic-chemistry',
      'alkenes addition reactions bromine',
      async () => [ORGANIC_PASSAGE],
      async () => {
        throw new Error('fallback should not run when passages exist');
      },
    );

    expect(result.citations).toEqual([{
      title: ORGANIC_PASSAGE.title,
      page: 12,
      excerpt: ORGANIC_PASSAGE.content,
    }]);
    expect(result.grounding?.facts[0]?.concept).toContain('p.12');
    expect(result.grounding?.facts[0]?.statement).toContain('double bond');
  });

  it('falls back to quiz-explanation grounding when no chunks exist', async () => {
    const fallbackGrounding: TopicGrounding = {
      topicId: 'chemistry-organic-chemistry',
      subconcepts: [{ name: 'Alkenes', description: 'Unsaturated hydrocarbons.' }],
      facts: [{ concept: 'Quiz bank', statement: 'Alkenes decolourise bromine water.' }],
    };
    const result = await loadCaptureGrounding(
      'chemistry-organic-chemistry',
      'alkenes',
      async () => [],
      async () => fallbackGrounding,
    );

    expect(result.citations).toEqual([]);
    expect(result.grounding).toEqual(fallbackGrounding);
  });

  it('falls back to quiz-explanation grounding when retrieval throws', async () => {
    const fallbackGrounding: TopicGrounding = {
      topicId: 'chemistry-organic-chemistry',
      subconcepts: [{ name: 'Alkenes', description: 'Unsaturated hydrocarbons.' }],
      facts: [{ concept: 'Quiz bank', statement: 'Alkenes decolourise bromine water.' }],
    };
    const result = await loadCaptureGrounding(
      'chemistry-organic-chemistry',
      'alkenes',
      async () => {
        throw new Error('operator does not exist');
      },
      async () => fallbackGrounding,
    );

    expect(result.citations).toEqual([]);
    expect(result.grounding).toEqual(fallbackGrounding);
  });

  it('does not query the database when embeddings are unconfigured', async () => {
    await expect(retrieveTopicPassages(
      'chemistry-organic-chemistry',
      'alkenes addition reactions',
      null,
    )).resolves.toEqual([]);
  });
});
