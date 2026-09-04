import { describe, expect, it, vi } from 'vitest';

import { buildSummaryPrompt, parseSummary, summarizeNotes } from '../src/services/summarize-notes.js';
import type { AnalysisModel } from '../src/services/explanation-analysis.js';

describe('buildSummaryPrompt', () => {
  it('includes the notes and warns about OCR noise without a syllabus grounding', () => {
    const prompt = buildSummaryPrompt('mitosis makes two identical cells');
    expect(prompt).toContain('mitosis makes two identical cells');
    expect(prompt).toMatch(/OCR/);
    // A summary reflects what the student wrote, not what the syllabus says --
    // it must not be told to judge against reference material the way
    // evaluateNotes() is.
    expect(prompt).not.toMatch(/REFERENCE FACTS/);
  });
});

describe('parseSummary', () => {
  it('reads a well-formed points array', () => {
    expect(parseSummary('{"points":["Mitosis makes two identical cells","Occurs in the cell cycle"]}'))
      .toEqual(['Mitosis makes two identical cells', 'Occurs in the cell cycle']);
  });

  it('reads points wrapped in a code fence or prose', () => {
    expect(parseSummary('```json\n{"points":["A point"]}\n```')).toEqual(['A point']);
    expect(parseSummary('Sure, here:\n{"points":["A point"]}\nDone.')).toEqual(['A point']);
  });

  it('drops non-string entries instead of surfacing blank bullets', () => {
    expect(parseSummary('{"points":["Real point", null, "", 42]}')).toEqual(['Real point']);
  });

  it('returns an empty array for a deliberate empty result, and null for unusable ones', () => {
    expect(parseSummary('{"points":[]}')).toEqual([]);
    expect(parseSummary('not json at all')).toBeNull();
    expect(parseSummary('{"other":"shape"}')).toBeNull();
  });
});

describe('summarizeNotes', () => {
  it('does not call the model for notes too short to summarize', async () => {
    const complete = vi.fn();
    expect(await summarizeNotes('too short', { complete })).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('calls the model and returns its parsed points', async () => {
    const model: AnalysisModel = { complete: async () => '{"points":["Key idea one","Key idea two"]}' };
    const result = await summarizeNotes('these notes are long enough to actually be worth summarizing', model);
    expect(result).toEqual(['Key idea one', 'Key idea two']);
  });
});
