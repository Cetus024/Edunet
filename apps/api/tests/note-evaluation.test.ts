import { describe, expect, it, vi } from 'vitest';

import {
  buildNoteEvaluationPrompt,
  evaluateNotes,
  parseNoteEvaluation,
  scoreFromVerdict,
} from '../src/services/note-evaluation.js';
import type { AnalysisModel, TopicGrounding } from '../src/services/explanation-analysis.js';

const GROUNDING: TopicGrounding = {
  topicId: 'geography-rivers',
  subconcepts: [
    { name: 'River Processes', description: 'Erosion, transportation, and deposition.' },
    { name: 'Fluvial Landforms', description: 'Meanders, waterfalls, and floodplains.' },
  ],
  facts: [
    { concept: 'Meanders', statement: 'Faster flow on the outside bend causes erosion.' },
    { concept: 'River Transport', statement: 'Traction rolls large particles along the bed.' },
  ],
};

const WELL_FORMED = JSON.stringify({
  correct: [{ point: 'Erosion on the outer bend', quote: 'outer bend erodes faster' }],
  incorrect: [{ point: 'Traction', quote: 'traction carries dissolved minerals', correction: 'Traction rolls large particles along the bed, not dissolved minerals.' }],
  missing: ['Floodplains form from repeated flooding'],
  summary: 'You had erosion right. Traction needs correcting, and floodplains are missing.',
});

const fakeModel = (reply: string): AnalysisModel => ({ complete: async () => reply });

describe('buildNoteEvaluationPrompt', () => {
  const prompt = buildNoteEvaluationPrompt(GROUNDING, 'the outer bend erodes faster than the inner bend');

  it('supplies the grounding rather than relying on the model knowing the syllabus', () => {
    expect(prompt).toContain('Faster flow on the outside bend causes erosion.');
    expect(prompt).toContain('Judge ONLY against the reference material below');
  });

  it('warns that the source is OCR, not speech', () => {
    // A wrong caveat here would make the model report a misread character as a
    // student mistake, which is the same failure mode explanation-analysis.ts
    // guards against for speech -- but OCR's noise is a different shape.
    expect(prompt).toMatch(/OCR/);
    expect(prompt).not.toMatch(/speech-to-text/i);
  });

  it('tells the model that incorrect means contradicted, not merely absent', () => {
    expect(prompt).toContain('CONTRADICT');
  });
});

describe('scoreFromVerdict', () => {
  it('scores 0 when there is nothing to judge, not a divide-by-zero 100', () => {
    expect(scoreFromVerdict({ correct: [], incorrect: [], missing: [], summary: '' })).toBe(0);
  });

  it('weighs correct against everything judged, not against correct alone', () => {
    // 2 correct out of 4 total judged points is 50%, not 100%.
    expect(scoreFromVerdict({
      correct: [{ point: 'a', quote: '' }, { point: 'b', quote: '' }],
      incorrect: [{ point: 'c', quote: '', correction: '' }],
      missing: ['d'],
      summary: '',
    })).toBe(50);
  });

  it('scores an incorrect point the same as a missing one, not worse', () => {
    const allWrong = scoreFromVerdict({
      correct: [],
      incorrect: [{ point: 'a', quote: '', correction: '' }, { point: 'b', quote: '', correction: '' }],
      missing: [],
      summary: '',
    });
    const allMissing = scoreFromVerdict({
      correct: [],
      incorrect: [],
      missing: ['a', 'b'],
      summary: '',
    });
    expect(allWrong).toBe(allMissing);
  });
});

describe('parseNoteEvaluation', () => {
  it('parses a well-formed reply and attaches the derived percentage', () => {
    const result = parseNoteEvaluation(WELL_FORMED);
    expect(result?.incorrect[0].correction).toContain('not dissolved minerals');
    expect(result?.percentage).toBe(33); // 1 correct of 3 judged points
  });

  it('reads JSON wrapped in a code fence or prose', () => {
    expect(parseNoteEvaluation(`\`\`\`json\n${WELL_FORMED}\n\`\`\``)?.summary).toContain('erosion right');
    expect(parseNoteEvaluation(`Here you go:\n${WELL_FORMED}`)?.correct).toHaveLength(1);
  });

  it('returns null rather than throwing on an unparseable reply', () => {
    expect(parseNoteEvaluation('I cannot help with that.')).toBeNull();
    expect(parseNoteEvaluation('{ not json }')).toBeNull();
  });
});

describe('evaluateNotes', () => {
  it('does not call the model for notes too short to judge', async () => {
    const complete = vi.fn();
    expect(await evaluateNotes('geography-rivers', 'rivers are wet', { complete })).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not call the model for a topic with no grounding', async () => {
    const complete = vi.fn();
    const result = await evaluateNotes(
      'not-a-real-topic',
      'these notes are definitely long enough to be worth judging against something',
      { complete },
    );
    expect(result).toBeNull();
    expect(complete).not.toHaveBeenCalled();
  });

  it('scores an end-to-end call without touching the database', async () => {
    const result = await evaluateNotes(
      'geography-rivers',
      'the outer bend of a river erodes faster because the water moves quicker there',
      fakeModel(WELL_FORMED),
      async () => GROUNDING,
    );
    expect(result?.percentage).toBe(33);
    expect(result?.missing).toContain('Floodplains form from repeated flooding');
  });
});
