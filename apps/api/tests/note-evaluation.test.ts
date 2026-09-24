import { describe, expect, it, vi } from 'vitest';

import {
  buildImprovementSteps,
  buildNoteEvaluationPrompt,
  evaluateNotes,
  extractLearningObjectives,
  parseNoteEvaluation,
  scoreFromObjectiveVerdicts,
} from '../src/services/note-evaluation.js';
import type { AnalysisModel, TopicGrounding } from '../src/services/explanation-analysis.js';

const GROUNDING: TopicGrounding = {
  topicId: 'geography-rivers',
  subconcepts: [
    { id: 'processes', name: 'River Processes', description: 'Erosion, transportation, and deposition.' },
    { id: 'landforms', name: 'Fluvial Landforms', description: 'Meanders, waterfalls, and floodplains.' },
  ],
  facts: [
    { concept: 'Meanders', statement: 'Faster flow on the outside bend causes erosion of the outer bank.' },
    { concept: 'River Transport', statement: 'Traction rolls large particles along the bed of the river channel.' },
  ],
};

const POINTS = extractLearningObjectives(GROUNDING.subconcepts, GROUNDING.facts);

const FIRST_OBJECTIVE_ID = POINTS[0]?.objectiveId;
const OBJECTIVE_COUNT = new Set(POINTS.map((point) => point.objectiveId)).size;
const EXPECTED_PERCENTAGE = Math.round((1 / Math.max(OBJECTIVE_COUNT, 1)) * 100);

const WELL_FORMED = JSON.stringify({
  verdicts: POINTS.map((point) => ({
    id: point.id,
    verdict: point.objectiveId === FIRST_OBJECTIVE_ID ? 'accurate' : 'missing',
    point: point.objectiveId === FIRST_OBJECTIVE_ID ? 'The outer bend erodes faster than the inner bend.' : '',
    quote: point.objectiveId === FIRST_OBJECTIVE_ID ? 'outer bend erodes faster' : '',
    correction: '',
  })),
  improvements: ['Add a labelled sketch of a meander and floodplain.'],
  summary: 'You had river processes right. Fluvial landforms are still missing.',
});

const fakeModel = (reply: string): AnalysisModel => ({ complete: async () => reply });

describe('extractLearningObjectives', () => {
  it('turns textbook sentences into mark-scheme points, capped per learning objective', () => {
    const points = extractLearningObjectives(GROUNDING.subconcepts, [
      ...GROUNDING.facts,
      { concept: 'Meanders', statement: 'Deposition happens on the inner bend where the current is slower.' },
      { concept: 'Meanders', statement: 'Over time this can cut off a meander to form an oxbow lake.' },
    ]);

    expect(points.length).toBeGreaterThan(2);
    expect(points.every((point) => point.id.startsWith('lo-'))).toBe(true);
    expect(points.some((point) => point.statement.includes('oxbow lake'))).toBe(true);
  });
});

describe('buildNoteEvaluationPrompt', () => {
  const prompt = buildNoteEvaluationPrompt(
    GROUNDING,
    'the outer bend erodes faster than the inner bend',
    POINTS,
  );

  it('supplies the grounding rather than relying on the model knowing the syllabus', () => {
    expect(prompt).toContain('Faster flow on the outside bend causes erosion of the outer bank.');
    expect(prompt).toContain('Judge ONLY against the textbook / syllabus points below');
  });

  it('warns that the source is OCR, not speech', () => {
    expect(prompt).toMatch(/OCR/);
    expect(prompt).not.toMatch(/speech-to-text/i);
  });

  it('tells the model that incorrect means contradicted, not merely absent', () => {
    expect(prompt).toContain('CONTRADICT');
  });

  it('tells the model to use labelled textbook lines rather than outside knowledge', () => {
    expect(prompt).toContain('labelled point');
    expect(prompt).toContain('not unstated knowledge');
    expect(prompt).toContain('Faster flow on the outside bend causes erosion of the outer bank.');
  });

  it('asks for per-objective verdicts and keeps scoring off the model', () => {
    expect(prompt).toContain('"verdicts"');
    expect(prompt).toContain('Do not return a percentage');
    expect(prompt).toContain('a partial answer is worth half');
    expect(prompt).toMatch(/Never mention page numbers, figure numbers/i);
  });
});

describe('scoreFromObjectiveVerdicts', () => {
  it('scores 0 when there is nothing to judge, not a divide-by-zero 100', () => {
    expect(scoreFromObjectiveVerdicts([], [])).toEqual({
      percentage: 0,
      accurateCount: 0,
      objectiveCount: 0,
    });
  });

  it('uses the unique learning-objective total, not extra student claims', () => {
    expect(scoreFromObjectiveVerdicts(
      [
        { id: 'lo-1', objectiveId: 'a' },
        { id: 'lo-2', objectiveId: 'a' },
        { id: 'lo-3', objectiveId: 'b' },
        { id: 'lo-4', objectiveId: 'b' },
      ],
      [
        { id: 'lo-1', verdict: 'accurate' },
        { id: 'lo-2', verdict: 'accurate' },
        { id: 'waffle', verdict: 'accurate' },
        { id: 'lo-1', verdict: 'accurate' },
        { id: 'lo-3', verdict: 'accurate' },
        { id: 'lo-4', verdict: 'missing' },
      ],
    )).toEqual({
      percentage: 75,
      accurateCount: 1.5,
      objectiveCount: 2,
    });
  });

  it('gives proportional credit when a skill is mostly accurate', () => {
    expect(scoreFromObjectiveVerdicts(
      [
        { id: 'lo-1', objectiveId: 'redox' },
        { id: 'lo-2', objectiveId: 'redox' },
        { id: 'lo-3', objectiveId: 'redox' },
      ],
      [
        { id: 'lo-1', verdict: 'accurate' },
        { id: 'lo-2', verdict: 'accurate' },
        { id: 'lo-3', verdict: 'partial' },
      ],
    )).toEqual({
      percentage: 83,
      accurateCount: 0.8,
      objectiveCount: 1,
    });
  });

  it('gives half credit for a partial answer and none for incorrect or missing', () => {
    const points = [
      { id: 'lo-1', objectiveId: 'a' },
      { id: 'lo-2', objectiveId: 'b' },
    ];
    expect(scoreFromObjectiveVerdicts(points, [
      { id: 'lo-1', verdict: 'partial' },
      { id: 'lo-2', verdict: 'incorrect' },
    ])).toEqual({
      percentage: 25,
      accurateCount: 0.5,
      objectiveCount: 2,
    });
    expect(scoreFromObjectiveVerdicts(points, [
      { id: 'lo-1', verdict: 'missing' },
      { id: 'lo-2', verdict: 'missing' },
    ]).percentage).toBe(0);
  });
});

describe('parseNoteEvaluation', () => {
  it('parses a well-formed reply and attaches the derived percentage and formula', () => {
    const result = parseNoteEvaluation(WELL_FORMED, POINTS);
    expect(result?.percentage).toBe(EXPECTED_PERCENTAGE);
    expect(result?.accurateCount).toBe(1);
    expect(result?.objectiveCount).toBe(OBJECTIVE_COUNT);
    expect(result?.formulaMarkdown).toContain(`\\dfrac{1}{${OBJECTIVE_COUNT}}`);
    expect(result?.formulaMarkdown).toContain(`${EXPECTED_PERCENTAGE}\\%`);
    expect(result?.correct[0]?.point).toBe('The outer bend erodes faster than the inner bend.');
    expect(result?.missing[0]).not.toContain('**');
    expect(result?.missing[0]?.length).toBeGreaterThan(20);
  });

  it('ignores a percentage the model tries to invent', () => {
    const result = parseNoteEvaluation(JSON.stringify({
      percentage: 100,
      verdicts: POINTS.map((point) => ({
        id: point.id,
        verdict: point.objectiveId === FIRST_OBJECTIVE_ID ? 'accurate' : 'missing',
        quote: '',
        correction: '',
      })),
      improvements: [],
      summary: 'You covered one objective.',
    }), POINTS);
    expect(result?.percentage).toBe(EXPECTED_PERCENTAGE);
  });

  it('reads JSON wrapped in a code fence or prose', () => {
    expect(parseNoteEvaluation(`\`\`\`json\n${WELL_FORMED}\n\`\`\``, POINTS)?.summary).toContain('river processes');
    expect(parseNoteEvaluation(`Here you go:\n${WELL_FORMED}`, POINTS)?.correct.length).toBeGreaterThan(0);
  });

  it('returns null rather than throwing on an unparseable reply', () => {
    expect(parseNoteEvaluation('I cannot help with that.', POINTS)).toBeNull();
    expect(parseNoteEvaluation('{ not json }', POINTS)).toBeNull();
  });

  it('keeps model improvement steps when they are present', () => {
    const result = parseNoteEvaluation(WELL_FORMED, POINTS);
    expect(result?.improvements).toEqual([
      'Add a labelled sketch of a meander and floodplain.',
    ]);
  });

  it('shows missing points as short definition-style sentences', () => {
    const result = parseNoteEvaluation(JSON.stringify({
      verdicts: POINTS.map((point, index) => ({
        id: point.id,
        verdict: index === 0 ? 'accurate' : 'missing',
        point: index === 0
          ? 'The outer bend erodes faster than the inner bend.'
          : 'Definition of oxidation and reduction in terms of the gain and loss of oxygen.',
        quote: '',
        correction: '',
      })),
      improvements: [],
      summary: 'You covered processes. Add the missing definitions.',
    }), POINTS);
    expect(result?.missing[0]).toBe(
      'Definition of oxidation and reduction in terms of the gain and loss of oxygen.',
    );
    expect(result?.missing[0]).not.toContain('Incomplete:');
  });
});

describe('buildImprovementSteps', () => {
  it('derives rewrite and add steps when the model omits improvements', () => {
    expect(buildImprovementSteps({
      incorrect: [{ point: 'Traction', quote: '', correction: 'Traction rolls large particles along the bed.' }],
      missing: ['Floodplains form from repeated flooding'],
      improvements: [],
    })).toEqual([
      'Rewrite the note on Traction: Traction rolls large particles along the bed.',
      'Add this to your notes: Floodplains form from repeated flooding',
    ]);
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
    expect(result?.percentage).toBe(EXPECTED_PERCENTAGE);
    expect(result?.objectiveCount).toBe(OBJECTIVE_COUNT);
    expect(result?.missing[0]).not.toContain('**');
    expect(result?.improvements[0]).toContain('labelled sketch');
  });
});
