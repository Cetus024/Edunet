import { describe, expect, it } from 'vitest';

import {
  chunkText,
  excerptForCitation,
  rankByCosine,
} from '../src/lib/text-chunks.js';

describe('chunkText', () => {
  it('keeps a short passage as a single chunk', () => {
    expect(chunkText('Alkenes contain a carbon-carbon double bond.')).toEqual([
      'Alkenes contain a carbon-carbon double bond.',
    ]);
  });

  it('splits long text with overlap rather than dropping the tail', () => {
    const text = Array.from({ length: 80 }, (_, index) => `sentence${index}`).join(' ');
    const chunks = chunkText(text, 80, 20);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join(' ')).toContain('sentence0');
    expect(chunks.at(-1)).toContain('sentence79');
  });
});

describe('rankByCosine', () => {
  it('ranks an organic-chemistry vector above a geometry vector for a chemistry query', () => {
    const organic = { id: 'organic', embedding: [1, 0, 0] };
    const geometry = { id: 'geometry', embedding: [0, 1, 0] };
    const ranked = rankByCosine([0.95, 0.05, 0], [geometry, organic], 2);
    expect(ranked.map((item) => item.id)).toEqual(['organic', 'geometry']);
  });
});

describe('excerptForCitation', () => {
  it('does not return a full long passage to the browser', () => {
    const content = Array.from({ length: 80 }, () => 'hydrocarbon').join(' ');
    const excerpt = excerptForCitation(content);
    expect(excerpt.endsWith('ΓÇª')).toBe(true);
    expect(excerpt.length).toBeLessThan(content.length);
    expect(excerpt.length).toBeLessThanOrEqual(281);
  });
});
