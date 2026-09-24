import { describe, expect, it, vi } from 'vitest';

import { AnalysisProviderError } from '../src/services/analysis-error.js';
import {
  EDUNETS_GUIDE,
  SPIDEY_OFF_TOPIC_REPLY,
  answerSpideyChat,
  buildSpideyChatPrompt,
  looksLikeEduNetsQuestion,
  normaliseSpideyReply,
} from '../src/services/spidey-chat.js';

describe('buildSpideyChatPrompt', () => {
  const prompt = buildSpideyChatPrompt(
    [{ role: 'user', text: 'How do I scan my notes?' }],
    [{ name: 'Organic Chemistry Notes', subject: 'chemistry', topic: 'Organic Chemistry' }],
  );

  it('explains EduNets features instead of inventing textbook facts', () => {
    expect(prompt).toContain(EDUNETS_GUIDE.slice(0, 40));
    expect(prompt).toContain('Revision Hub');
    expect(prompt).toContain('How do I scan my notes?');
    expect(prompt).toContain('Organic Chemistry Notes');
    expect(prompt).toContain('Do not invent syllabus facts');
    expect(prompt).toContain('friendly study buddy');
    expect(prompt).toContain('Notes Library');
    expect(prompt).toContain('ONLY answer questions about EduNets');
    expect(prompt).toContain(SPIDEY_OFF_TOPIC_REPLY.slice(0, 40));
    expect(prompt).toContain('2 to 4 bullets');
    expect(prompt).toContain('under 90 words');
  });
});

describe('looksLikeEduNetsQuestion', () => {
  it('accepts platform questions and refuses unrelated ones', () => {
    expect(looksLikeEduNetsQuestion('How do I scan my notes?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Where is Notes Library?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Open Revision Hub')).toBe(true);
    expect(looksLikeEduNetsQuestion('What is the capital of France?')).toBe(false);
    expect(looksLikeEduNetsQuestion('Write my chemistry essay for me')).toBe(false);
  });
});

describe('normaliseSpideyReply', () => {
  it('keeps a short opener and caps bullets', () => {
    expect(normaliseSpideyReply([
      'Here is how to scan your notes in Revision Hub.',
      '- Open Revision Hub.',
      '- Choose Scan Handwritten Notes.',
      '- Take a clear photo of one page.',
      '- Check the extracted text.',
      '- Save it to My Materials Library.',
      '- Share it with a friend.',
    ].join('\n'))).toBe([
      'Here is how to scan your notes in Revision Hub.',
      '- Open Revision Hub.',
      '- Choose Scan Handwritten Notes.',
      '- Take a clear photo of one page.',
      '- Check the extracted text.',
      '- Save it to My Materials Library.',
    ].join('\n'));
  });

  it('turns a long paragraph into one sentence plus bullets', () => {
    expect(normaliseSpideyReply(
      'Use Revision Hub to scan notes. Open the Scan tile. Photograph one page. Check the text before you save.',
    )).toBe([
      'Use Revision Hub to scan notes.',
      '- Open the Scan tile.',
      '- Photograph one page.',
      '- Check the text before you save.',
    ].join('\n'));
  });
});

describe('answerSpideyChat', () => {
  it('returns the model reply for a general enquiry', async () => {
    const complete = vi.fn().mockResolvedValue('Open Revision Hub and use Scan Handwritten Notes.');
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'How do I scan my notes?' }] },
      { complete },
    );
    expect(result.text).toContain('Revision Hub');
    expect(complete).toHaveBeenCalledOnce();
  });

  it('skips the model for off-topic questions', async () => {
    const complete = vi.fn();
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'Who won the World Cup?' }] },
      { complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(result.text).toBe(SPIDEY_OFF_TOPIC_REPLY);
  });

  it('rejects an empty model reply', async () => {
    await expect(answerSpideyChat(
      { messages: [{ role: 'user', text: 'Hi' }] },
      { complete: async () => '   ' },
    )).rejects.toBeInstanceOf(AnalysisProviderError);
  });
});
