import { describe, expect, it, vi } from 'vitest';

import { AnalysisProviderError } from '../src/services/analysis-error.js';
import {
  EDUNETS_GUIDE,
  answerSpideyChat,
  buildSpideyChatPrompt,
  normaliseSpideyReply,
} from '../src/services/spidey-chat.js';

describe('buildSpideyChatPrompt', () => {
  const prompt = buildSpideyChatPrompt(
    [{ role: 'user', text: 'How do I scan my notes?' }],
    [{ name: 'Organic Chemistry Notes', subject: 'chemistry', topic: 'Organic Chemistry' }],
  );

  it('explains EduNets features instead of inventing textbook facts', () => {
    expect(prompt).toContain(EDUNETS_GUIDE.slice(0, 40));
    expect(prompt).toContain('Capture Hub');
    expect(prompt).toContain('How do I scan my notes?');
    expect(prompt).toContain('Organic Chemistry Notes');
    expect(prompt).toContain('Do not invent syllabus facts');
    expect(prompt).toContain('3 to 5 bullets');
    expect(prompt).toContain('under 80 words');
  });
});

describe('normaliseSpideyReply', () => {
  it('keeps a short opener and caps bullets', () => {
    expect(normaliseSpideyReply([
      'Here is how to scan your notes in Capture Hub.',
      '- Open Capture Hub.',
      '- Choose Scan Handwritten Notes.',
      '- Take a clear photo of one page.',
      '- Check the extracted text.',
      '- Save it to My Materials Library.',
      '- Share it with a friend.',
    ].join('\n'))).toBe([
      'Here is how to scan your notes in Capture Hub.',
      '- Open Capture Hub.',
      '- Choose Scan Handwritten Notes.',
      '- Take a clear photo of one page.',
      '- Check the extracted text.',
      '- Save it to My Materials Library.',
    ].join('\n'));
  });

  it('turns a long paragraph into one sentence plus bullets', () => {
    expect(normaliseSpideyReply(
      'Use Capture Hub to scan notes. Open the Scan tile. Photograph one page. Check the text before you save.',
    )).toBe([
      'Use Capture Hub to scan notes.',
      '- Open the Scan tile.',
      '- Photograph one page.',
      '- Check the text before you save.',
    ].join('\n'));
  });
});

describe('answerSpideyChat', () => {
  it('returns the model reply for a general enquiry', async () => {
    const complete = vi.fn().mockResolvedValue('Open Capture Hub and use Scan Handwritten Notes.');
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'How do I scan my notes?' }] },
      { complete },
    );
    expect(result.text).toContain('Capture Hub');
    expect(complete).toHaveBeenCalledOnce();
  });

  it('rejects an empty model reply', async () => {
    await expect(answerSpideyChat(
      { messages: [{ role: 'user', text: 'Hi' }] },
      { complete: async () => '   ' },
    )).rejects.toBeInstanceOf(AnalysisProviderError);
  });
});
