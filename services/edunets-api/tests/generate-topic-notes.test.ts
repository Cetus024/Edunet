import { describe, expect, it, vi } from 'vitest';

import {
  NO_TEXTBOOK_REPLY,
  buildTopicNotesPrompt,
  ensureTopicNotesMarkup,
  generateTopicNotes,
  notesRetrievalQuery,
} from '../src/services/generate-topic-notes.js';

const PASSAGES = [{
  title: 'O-Level Chemistry textbook',
  page: 361,
  content: 'Alkenes decolourise aqueous bromine. This is the test for unsaturation.',
}];

describe('notesRetrievalQuery', () => {
  it('uses the topic syllabus rather than a vague make-notes phrase', () => {
    expect(notesRetrievalQuery('chemistry-organic-chemistry')).toMatch(/Organic Chemistry/i);
  });

  it('narrows the query when a subtopic focus is provided', () => {
    expect(notesRetrievalQuery('chemistry-organic-chemistry', {
      name: 'Alkenes',
      description: 'Reactions and tests for unsaturation.',
    })).toMatch(/Focus on subtopic: Alkenes/i);
  });
});

describe('buildTopicNotesPrompt', () => {
  const prompt = buildTopicNotesPrompt('chemistry-organic-chemistry', PASSAGES);

  it('grounds notes in labelled textbook passages only', () => {
    expect(prompt).toContain('ONLY the TEXTBOOK PASSAGES');
    expect(prompt).toContain('Do not use outside knowledge');
    expect(prompt).toContain('Alkenes decolourise aqueous bromine');
    expect(prompt).toContain('# Organic Chemistry');
    expect(prompt).toContain('## Revision notes');
    expect(prompt).toContain('KaTeX');
    expect(prompt).toContain('### Q1.');
    expect(prompt).toContain('$$');
    expect(prompt).toContain('\\ce{O2 + 4e- -> 2O^{2-}}');
    expect(prompt).not.toContain('Self-check');
    expect(prompt).not.toContain('Must-know facts');
    expect(prompt).not.toContain('p.361');
    expect(prompt).toMatch(/Never mention page numbers/i);
  });

  it('includes the subtopic focus line when provided', () => {
    const focused = buildTopicNotesPrompt('chemistry-organic-chemistry', PASSAGES, {
      name: 'Alkenes',
      description: 'Reactions and tests for unsaturation.',
    });
    expect(focused).toContain('SUBTOPIC FOCUS: Alkenes');
    expect(focused).toContain('# Alkenes');
    expect(focused).toMatch(/Ignore passage material that is clearly about other subtopics/i);
  });
});

describe('generateTopicNotes', () => {
  it('does not call the model when no textbook passages are retrieved', async () => {
    const complete = vi.fn();
    const result = await generateTopicNotes('math-geometry-measurement', { complete }, async () => []);
    expect(complete).not.toHaveBeenCalled();
    expect(result).toEqual({ text: NO_TEXTBOOK_REPLY, citations: [], grounded: false });
  });

  it('returns the model notes with citations when passages exist', async () => {
    const result = await generateTopicNotes(
      'chemistry-organic-chemistry',
      { complete: async () => 'Bromine test: alkenes decolourise aqueous bromine.' },
      async () => PASSAGES,
    );
    expect(result.grounded).toBe(true);
    expect(result.text).toContain('# Organic Chemistry');
    expect(result.text).toContain('Bromine test');
    expect(result.citations[0]?.title).toBe('O-Level Chemistry textbook');
  });

  it('adds a title when the model omits headings', () => {
    expect(ensureTopicNotesMarkup(
      'chemistry-organic-chemistry',
      'Alkenes decolourise aqueous bromine.',
    )).toBe('# Organic Chemistry\n\nAlkenes decolourise aqueous bromine.');
  });

  it('strips figure and page mentions from generated notes', () => {
    expect(ensureTopicNotesMarkup(
      'chemistry-redox',
      '# Redox\n\nOxygen gains electrons (see Figure 7.2 on page 361). While the.',
    )).not.toMatch(/Figure 7\.2|page 361|While the/i);
  });
});
