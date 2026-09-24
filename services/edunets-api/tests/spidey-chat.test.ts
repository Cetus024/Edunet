import { describe, expect, it, vi } from 'vitest';

import { AnalysisProviderError } from '../src/services/analysis-error.js';
import {
  EDUNETS_GUIDE,
  SPIDEY_MOTIVATION_REPLY,
  SPIDEY_NEXT_REPLY,
  SPIDEY_OFF_TOPIC_REPLY,
  SPIDEY_START_REPLY,
  SPIDEY_STORY_REPLY,
  SPIDEY_TEAM_REPLY,
  answerSpideyChat,
  buildSpideyChatPrompt,
  extractSpideyNavLinks,
  looksLikeEduNetsQuestion,
  looksLikeNextStepQuestion,
  looksLikeQuizHelpQuestion,
  looksLikeStartQuestion,
  looksLikeStoryQuestion,
  looksLikeSubjectQuestion,
  normaliseSpideyReply,
} from '../src/services/spidey-chat.js';

describe('buildSpideyChatPrompt', () => {
  const prompt = buildSpideyChatPrompt(
    [{ role: 'user', text: 'How do I scan my notes?' }],
    [{ name: 'Organic Chemistry Notes', subject: 'chemistry', topic: 'Organic Chemistry' }],
  );

  it('embeds Spidey persona, FAQ facts, and prose + nav format', () => {
    expect(prompt).toContain(EDUNETS_GUIDE.slice(0, 40));
    expect(prompt).toContain('Revision Hub');
    expect(prompt).toContain('How do I scan my notes?');
    expect(prompt).toContain('Organic Chemistry Notes');
    expect(prompt).toContain('Never invent features');
    expect(prompt).toContain('friendly guide inside EduNets');
    expect(prompt).toContain('six SIM');
    expect(prompt).toContain('WHERE TO START');
    expect(prompt).toContain('Do NOT use bullet points');
    expect(prompt).toContain('[[go:/quiz|Try Smart Quiz]]');
    expect(prompt).toContain('[[go:/capture-hub|Open Revision Hub]]');
    expect(prompt).toContain('Prefer Smart Quiz');
    expect(prompt).toContain('Notes Lab');
    expect(prompt).toContain(SPIDEY_OFF_TOPIC_REPLY.slice(0, 40));
  });
});

describe('looksLikeEduNetsQuestion', () => {
  it('accepts platform, getting-started, and orientation questions', () => {
    expect(looksLikeEduNetsQuestion('How do I scan my notes?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Where is Notes Library?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Open Revision Hub')).toBe(true);
    expect(looksLikeEduNetsQuestion('Who made you?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Where did Spidey come from?')).toBe(true);
    expect(looksLikeEduNetsQuestion('What is a memory score?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Where do I start?')).toBe(true);
    expect(looksLikeEduNetsQuestion('How to start on this')).toBe(true);
    expect(looksLikeEduNetsQuestion('What should I do first?')).toBe(true);
    expect(looksLikeEduNetsQuestion('What are the features?')).toBe(true);
    expect(looksLikeEduNetsQuestion('What do I do next after a quiz?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Where do I go next?')).toBe(true);
    expect(looksLikeEduNetsQuestion('Is there a mobile app?')).toBe(true);
    expect(looksLikeEduNetsQuestion('What is EduNets?')).toBe(true);
    expect(looksLikeEduNetsQuestion('What is the capital of France?')).toBe(false);
    expect(looksLikeEduNetsQuestion('Who won the World Cup?')).toBe(false);
    expect(looksLikeEduNetsQuestion('Can you explain covalent bonding?')).toBe(false);
  });
});

describe('looksLikeStoryQuestion', () => {
  it('spots Spidey and team background questions', () => {
    expect(looksLikeStoryQuestion('Where did Spidey come from?')).toBe(true);
    expect(looksLikeStoryQuestion('Who made EduNets?')).toBe(true);
    expect(looksLikeStoryQuestion('Tell me about the team behind EduNets')).toBe(true);
    expect(looksLikeStoryQuestion('Where do I start?')).toBe(false);
  });
});

describe('looksLikeStartQuestion', () => {
  it('spots getting-started phrasing', () => {
    expect(looksLikeStartQuestion('Where do I start?')).toBe(true);
    expect(looksLikeStartQuestion('How to start on this')).toBe(true);
    expect(looksLikeStartQuestion('What should I do first?')).toBe(true);
    expect(looksLikeStartQuestion('Who made you?')).toBe(false);
  });
});

describe('looksLikeSubjectQuestion', () => {
  it('spots homework and topic questions that are not about EduNets', () => {
    expect(looksLikeSubjectQuestion('Can you explain covalent bonding?')).toBe(true);
    expect(looksLikeSubjectQuestion('Define the mole concept for me')).toBe(true);
    expect(looksLikeSubjectQuestion('Open Revision Hub')).toBe(false);
    expect(looksLikeSubjectQuestion('Where do I start?')).toBe(false);
    expect(looksLikeSubjectQuestion('Who won the World Cup?')).toBe(false);
  });
});

describe('normaliseSpideyReply', () => {
  it('turns bullets into short paragraphs and keeps allowlisted nav chips', () => {
    expect(normaliseSpideyReply([
      'Here is how to scan your notes in Revision Hub.',
      '- Open Revision Hub.',
      '- Choose Scan Handwritten Notes.',
      '[[go:/capture-hub|Open Revision Hub]]',
      '[[go:/evil|Hack]]',
    ].join('\n'))).toBe([
      'Here is how to scan your notes in Revision Hub. Open Revision Hub.',
      'Choose Scan Handwritten Notes.',
      '[[go:/capture-hub|Open Revision Hub]]',
    ].join('\n'));
  });

  it('breaks long replies into short paragraphs', () => {
    expect(normaliseSpideyReply(
      'Great question! The Concept Web looks like a net. That is why I am Spidey.',
      { allowNav: false },
    )).toBe([
      'Great question! The Concept Web looks like a net.',
      'That is why I am Spidey.',
    ].join('\n'));
  });

  it('extracts only allowlisted nav paths', () => {
    expect(extractSpideyNavLinks('[[go:/dashboard|Dash]] [[go:/nope|X]]')).toEqual([
      { path: '/dashboard', label: 'Dash' },
    ]);
  });
});

describe('answerSpideyChat', () => {
  it('returns the canned start reply with nav chips', async () => {
    const complete = vi.fn();
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'Where do I start?' }] },
      { complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(result.text).toBe(SPIDEY_START_REPLY);
    expect(result.text.indexOf('[[go:/quiz|')).toBeLessThan(result.text.indexOf('[[go:/capture-hub|'));
    expect(result.text).toContain('[[go:/quiz|');
    expect(result.text).toContain('[[go:/capture-hub|');
  });

  it('returns the canned next-step reply with nav chips', async () => {
    const complete = vi.fn();
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'Where do I go next after a quiz?' }] },
      { complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(looksLikeNextStepQuestion('Where do I go next after a quiz?')).toBe(true);
    expect(result.text).toBe(SPIDEY_NEXT_REPLY);
    expect(result.text.indexOf('[[go:/quiz|')).toBeLessThan(result.text.indexOf('[[go:/capture-hub|'));
    expect(result.text).toContain('[[go:/quiz|');
    expect(result.text).toContain('[[go:/capture-hub|');
  });

  it('returns a brief team story without nav chips', async () => {
    const complete = vi.fn();
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'Who made EduNets?' }] },
      { complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(result.text).toBe(SPIDEY_TEAM_REPLY);
    expect(result.text).not.toContain('[[go:');
  });

  it('returns Spidey origin story without nav chips', async () => {
    const complete = vi.fn();
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'Where did Spidey come from?' }] },
      { complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(result.text).toBe(SPIDEY_STORY_REPLY);
    expect(result.text).not.toContain('[[go:');
  });

  it('returns the model reply for feature questions as prose', async () => {
    const complete = vi.fn().mockResolvedValue([
      'Concept Web shows how topics connect and your memory score on each node.',
      '[[go:/concept-web|Open Concept Web]]',
    ].join('\n'));
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'What does Concept Web do?' }] },
      { complete },
    );
    expect(result.text).toContain('Concept Web');
    expect(result.text).not.toMatch(/^- /m);
    expect(result.text).toContain('[[go:/concept-web|');
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

  it('gives motivation instead of answering quiz or subject questions', async () => {
    const complete = vi.fn();
    const result = await answerSpideyChat(
      { messages: [{ role: 'user', text: 'Can you explain covalent bonding?' }] },
      { complete },
    );
    expect(complete).not.toHaveBeenCalled();
    expect(looksLikeQuizHelpQuestion('What is the answer to question 3?')).toBe(true);
    expect(result.text).toBe(SPIDEY_MOTIVATION_REPLY);
    expect(result.text).not.toContain('[[go:');
  });

  it('rejects an empty model reply', async () => {
    await expect(answerSpideyChat(
      { messages: [{ role: 'user', text: 'Hi' }] },
      { complete: async () => '   ' },
    )).rejects.toBeInstanceOf(AnalysisProviderError);
  });
});
