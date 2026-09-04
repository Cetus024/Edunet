import { describe, expect, it, vi } from 'vitest';

import { assessCapturedNotes } from '../src/services/capture-analysis.js';
import type { AnalysisModel, TopicGrounding } from '../src/services/explanation-analysis.js';

const GROUNDING: TopicGrounding = {
  topicId: 'biology-cell-division',
  subconcepts: [{ name: 'Mitosis', description: 'Produces genetically identical cells.' }],
  facts: [{ concept: 'Mitosis', statement: 'Mitosis produces two genetically identical daughter cells.' }],
};

describe('assessCapturedNotes', () => {
  it('evaluates the generated summary rather than the raw OCR text', async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce(JSON.stringify({
        points: [
          'Mitosis produces two genetically identical daughter cells.',
          'The process supports growth and repair in multicellular organisms.',
        ],
      }))
      .mockResolvedValueOnce(JSON.stringify({
        correct: [{ point: 'Identical daughter cells', quote: 'genetically identical' }],
        incorrect: [],
        missing: ['Chromosome replication happens before mitosis'],
        summary: 'You captured the main outcome. Add the preparation step.',
      }));
    const model: AnalysisModel = { complete };

    const result = await assessCapturedNotes(
      'biology-cell-division',
      'raw handwritten mitosis notes with enough words to create a useful student summary today',
      model,
      async () => GROUNDING,
    );

    expect(result?.summaryPoints).toHaveLength(2);
    expect(result?.evaluation?.percentage).toBe(50);
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1][0]).toContain('Mitosis produces two genetically identical daughter cells.');
    expect(complete.mock.calls[1][0]).not.toContain('raw handwritten mitosis notes');
  });

  it('stops before database evaluation when no usable summary is produced', async () => {
    const complete = vi.fn().mockResolvedValue('{"points":[]}');
    const loadGrounding = vi.fn();

    const result = await assessCapturedNotes(
      'biology-cell-division',
      'these handwritten notes contain enough words but the model finds no usable ideas',
      { complete },
      loadGrounding,
    );

    expect(result).toBeNull();
    expect(loadGrounding).not.toHaveBeenCalled();
  });
});
