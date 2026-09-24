import { describe, expect, it, vi } from 'vitest';

import {
  NO_TEXTBOOK_FLASHCARDS_REPLY,
  buildFlashcardsPrompt,
  flashcardsRetrievalQuery,
  generateFlashcards,
  parseFlashcardsReply,
} from '../src/services/generate-flashcards.js';

const PASSAGES = [{
  title: 'O-Level Chemistry textbook',
  page: 361,
  content: 'Alkenes decolourise aqueous bromine. This is the test for unsaturation.',
}];

describe('flashcardsRetrievalQuery', () => {
  it('targets exam essentials for the topic', () => {
    expect(flashcardsRetrievalQuery('chemistry-organic-chemistry')).toMatch(/Organic Chemistry/i);
    expect(flashcardsRetrievalQuery('chemistry-organic-chemistry')).toMatch(/definitions|must-know|exam/i);
  });

  it('narrows the query when a subtopic focus is provided', () => {
    expect(flashcardsRetrievalQuery('chemistry-organic-chemistry', {
      name: 'Alkenes',
      description: 'Reactions and tests for unsaturation.',
    })).toMatch(/Focus on subtopic: Alkenes/i);
  });
});

describe('buildFlashcardsPrompt', () => {
  const prompt = buildFlashcardsPrompt('chemistry-organic-chemistry', PASSAGES);

  it('grounds cards in textbook passages only', () => {
    expect(prompt).toContain('ONLY the TEXTBOOK PASSAGES');
    expect(prompt).toContain('Alkenes decolourise aqueous bromine');
    expect(prompt).toContain('"cards"');
    expect(prompt).toMatch(/Never mention page numbers/i);
  });

  it('includes the subtopic focus line when provided', () => {
    const focused = buildFlashcardsPrompt('chemistry-organic-chemistry', PASSAGES, {
      name: 'Alkenes',
      description: 'Reactions and tests for unsaturation.',
    });
    expect(focused).toContain('SUBTOPIC FOCUS: Alkenes');
    expect(focused).toMatch(/Ignore passage material that is clearly about other subtopics/i);
  });
});

describe('parseFlashcardsReply', () => {
  it('reads a well-formed card list', () => {
    expect(parseFlashcardsReply(JSON.stringify({
      cards: [
        { front: 'Test for alkenes?', back: 'Decolourise aqueous bromine.' },
        { front: '', back: 'ignored' },
      ],
    }))).toEqual([
      { front: 'Test for alkenes?', back: 'Decolourise aqueous bromine.' },
    ]);
  });

  it('returns null for unusable replies', () => {
    expect(parseFlashcardsReply('not json')).toBeNull();
    expect(parseFlashcardsReply('{"cards":[]}')).toBeNull();
  });
});

describe('generateFlashcards', () => {
  it('does not call the model when no textbook passages are retrieved', async () => {
    const complete = vi.fn();
    const result = await generateFlashcards('math-geometry-measurement', { complete }, async () => []);
    expect(complete).not.toHaveBeenCalled();
    expect(result).toEqual({ cards: [], grounded: false });
    expect(NO_TEXTBOOK_FLASHCARDS_REPLY.length).toBeGreaterThan(20);
  });

  it('returns parsed cards when passages exist', async () => {
    const result = await generateFlashcards(
      'chemistry-organic-chemistry',
      {
        complete: async () => JSON.stringify({
          cards: [
            { front: 'Alkene bromine test', back: 'Alkenes decolourise aqueous bromine.' },
          ],
        }),
      },
      async () => PASSAGES,
    );
    expect(result.grounded).toBe(true);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]?.front).toContain('Alkene');
  });
});
