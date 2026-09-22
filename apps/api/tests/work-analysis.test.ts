import { describe, expect, it } from 'vitest';
import { analyseWork, buildWorkPrompt } from '../src/services/work-analysis.js';
import { workInputSchema } from '../src/work-validation.js';

const input = {
  question: 'Solve 2x = 6', transcript: '2x = 6\nx = 3', locale: 'en' as const,
  grounding: { topicId: 'algebra', subconcepts: [], facts: [] },
};
const verdict = {
  verdict: 'looks_consistent', summary: 'Division by two is consistent.',
  steps: [{ quote: 'x = 3', status: 'consistent', explanation: 'Both sides were divided by two.' }],
  conceptConflicts: [], limitations: [], options: [{ label: 'Check', explanation: 'Substitute 3 into 2x = 6.' }],
};
const model = (reply: unknown) => ({ complete: async () => JSON.stringify(reply) });

describe('handwritten work analysis', () => {
  it('retains exact algebra steps and separates untrusted content from review instructions', () => {
    const prompt = buildWorkPrompt(input);
    expect(prompt).toContain(JSON.stringify(input));
    expect(prompt).toContain('Do NOT summarize');
    expect(prompt).toContain('original drawing is NOT available');
  });
  it('accepts well-formed, grounded feedback', async () => {
    expect((await analyseWork(input, model(verdict))).verdict).toBe('looks_consistent');
  });
  it('rejects hallucinated quotes rather than displaying invented evidence', async () => {
    await expect(analyseWork(input, model({ ...verdict, steps: [{ ...verdict.steps[0], quote: 'x = 4' }] }))).rejects.toThrow('quoted text');
  });
  it('never reports consistency with an uncertain or absent step', async () => {
    expect((await analyseWork(input, model({ ...verdict, steps: [] }))).verdict).toBe('needs_clarification');
    expect((await analyseWork(input, model({ ...verdict, steps: [{ ...verdict.steps[0], status: 'uncertain' }] }))).verdict).toBe('needs_clarification');
  });
  it('does not turn unsupported conceptual feedback into a correct result', async () => {
    const result = await analyseWork({ ...input, grounding: null }, model(verdict));
    expect(result.verdict).toBe('needs_clarification');
    expect(result.limitations.join(' ')).toContain('Syllabus references are unavailable');
  });
  it('reports supported errors even if the model headline says consistent', async () => {
    const result = await analyseWork(input, model({ ...verdict, steps: [{ ...verdict.steps[0], status: 'error' }] }));
    expect(result.verdict).toBe('needs_revision');
  });
  it('rejects malformed replies and absent next options', async () => {
    await expect(analyseWork(input, model({ summary: 'All correct' }))).rejects.toThrow();
    await expect(analyseWork(input, model({ ...verdict, options: [] }))).rejects.toThrow();
  });
});

describe('handwritten submission validation', () => {
  const submission = {
    submissionId: '68f2a182-3d01-46b8-925c-da33882ca98e', question: input.question,
    transcript: input.transcript, questionIndex: 0, runNumber: 0, locale: 'en',
    strokes: [{ color: '#172554', width: 3, points: [{ x: 10, y: 20 }] }],
  };
  it('accepts a bounded drawing and confirmed solution', () => {
    expect(workInputSchema.safeParse(submission).success).toBe(true);
  });
  it('rejects blank work, invalid coordinates, and excessive drawing complexity', () => {
    expect(workInputSchema.safeParse({ ...submission, transcript: ' ' }).success).toBe(false);
    expect(workInputSchema.safeParse({ ...submission, strokes: [] }).success).toBe(false);
    expect(workInputSchema.safeParse({ ...submission, strokes: [{ ...submission.strokes[0], points: [{ x: -1, y: 0 }] }] }).success).toBe(false);
    const stroke = { ...submission.strokes[0], points: Array.from({ length: 2000 }, () => ({ x: 1, y: 2 })) };
    expect(workInputSchema.safeParse({ ...submission, strokes: Array(8).fill(stroke) }).success).toBe(false);
  });
});
