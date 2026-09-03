import { describe, expect, it } from 'vitest';

// The mediator is frontend logic, but it is pure and worth pinning, and this is
// the only vitest project in the repo — `npm run check` runs it. The API
// already imports from features/ for grounding, so the boundary is not new.
import {
  HINT_AFTER_SECONDS,
  SILENCE_NUDGE_SECONDS,
  STAGE_SECONDS,
  findRepeatedPhrase,
  nextCue,
  shouldAdvance,
  stagePrompt,
  type MediatorInput,
} from '../../../lib/discussion-mediator.js';

const SUBCONCEPTS = [
  { id: 'river-processes', name: 'River Processes', description: 'Erosion, transportation, and deposition shape a river.', keyConnectionTopic: 'Fluvial Landforms' },
  { id: 'fluvial-landforms', name: 'Fluvial Landforms', description: 'Meanders, waterfalls, and floodplains.', keyConnectionTopic: 'Flood Management' },
  { id: 'flood-management', name: 'Flood Management', description: 'Dams and other measures reduce flood risk.', keyConnectionTopic: 'River Processes' },
];

const coverage = (id: string, verdict: 'covered' | 'partial' | 'missed') =>
  [{ id, name: id, verdict, matchedTerms: [], missingTerms: [] }];

const base: MediatorInput = {
  subconcepts: SUBCONCEPTS,
  coverage: [],
  stageIndex: 0,
  elapsedInStage: 5,
  silenceSeconds: 0,
  repeatedPhrase: null,
};

describe('nextCue', () => {
  it('says nothing while the speaker is mid-flow', () => {
    // The common case, and the point: a mediator that talks constantly is worse
    // than none at all.
    expect(nextCue(base)).toBeNull();
  });

  it('moves on once the current subconcept is covered, naming the next one', () => {
    const cue = nextCue({ ...base, coverage: coverage('river-processes', 'covered') });
    expect(cue?.kind).toBe('advance');
    expect(cue?.text).toContain('Fluvial Landforms');
  });

  it('does not promise a next subconcept when finishing the last one', () => {
    const cue = nextCue({
      ...base,
      stageIndex: 2,
      coverage: coverage('flood-management', 'covered'),
    });
    expect(cue?.kind).toBe('advance');
    expect(cue?.text).toContain('all three');
  });

  it('nudges after a silence, asking rather than telling', () => {
    const cue = nextCue({ ...base, silenceSeconds: SILENCE_NUDGE_SECONDS });
    expect(cue?.kind).toBe('nudge');
    expect(cue?.text).toContain('?');
    // A mediator that supplies the answer ends the thinking it was meant to
    // restart, so the description must not appear here.
    expect(cue?.text).not.toContain(SUBCONCEPTS[0].description);
  });

  it('prefers advancing over nudging when both apply', () => {
    const cue = nextCue({
      ...base,
      silenceSeconds: 30,
      coverage: coverage('river-processes', 'covered'),
    });
    expect(cue?.kind).toBe('advance');
  });

  it('calls out circling on the same phrase', () => {
    const cue = nextCue({ ...base, repeatedPhrase: 'the water flows down' });
    expect(cue?.kind).toBe('repeat');
    expect(cue?.text).toContain('the water flows down');
  });

  it('only offers the content hint late in a stage', () => {
    expect(nextCue({ ...base, elapsedInStage: HINT_AFTER_SECONDS - 1 })).toBeNull();
    const cue = nextCue({ ...base, elapsedInStage: HINT_AFTER_SECONDS });
    expect(cue?.kind).toBe('hint');
    expect(cue?.text).toContain(SUBCONCEPTS[0].description);
  });

  it('reports completion once the stages run out', () => {
    expect(nextCue({ ...base, stageIndex: 3 })?.kind).toBe('done');
  });
});

describe('shouldAdvance', () => {
  it('advances on coverage before the stage clock runs out', () => {
    expect(shouldAdvance({ ...base, coverage: coverage('river-processes', 'covered') })).toBe(true);
  });

  it('advances when the stage time is spent even with nothing covered', () => {
    expect(shouldAdvance({ ...base, elapsedInStage: STAGE_SECONDS })).toBe(true);
  });

  it('holds while there is still time and the point is unmade', () => {
    expect(shouldAdvance({ ...base, elapsedInStage: 20 })).toBe(false);
    expect(shouldAdvance({ ...base, coverage: coverage('river-processes', 'partial') })).toBe(false);
  });

  it('does not advance past the end', () => {
    expect(shouldAdvance({ ...base, stageIndex: 3, elapsedInStage: 999 })).toBe(false);
  });
});

describe('findRepeatedPhrase', () => {
  it('finds a clause said twice in the recent tail', () => {
    expect(findRepeatedPhrase('the river flows down the hill and then the river flows down the hill again'))
      .toBe('the river flows down');
  });

  it('ignores a short transcript with nothing to judge', () => {
    expect(findRepeatedPhrase('the river flows')).toBeNull();
  });

  it('does not flag ordinary prose', () => {
    expect(findRepeatedPhrase(
      'erosion happens on the outside bend while deposition builds up sediment on the inside of the meander',
    )).toBeNull();
  });

  it('ignores a phrase reused long ago rather than just now', () => {
    // Only the recent tail counts — reusing a phrase a minute apart is not
    // stalling, it is just talking. The filler between the two uses has to be
    // genuinely varied, or it supplies a repeat of its own.
    const long = [
      'the river flows down the hill',
      'sediment gets picked up near the source and dropped further downstream',
      'traction rolls the heavier stones while lighter material stays suspended',
      'a meander forms where flow speed differs across the channel',
      'the river flows down the hill',
    ].join(' ');
    // A 20-word tail reaches back only into the meander clause and the final
    // repeat, so the early use is out of scope.
    expect(findRepeatedPhrase(long, 20)).toBeNull();
    // Widen the window past both uses and it is found.
    expect(findRepeatedPhrase(long, 200)).toBe('the river flows down');
  });
});

describe('stagePrompt', () => {
  it('asks for one subconcept rather than the whole topic', () => {
    expect(stagePrompt(SUBCONCEPTS[1])).toBe('Explain Fluvial Landforms.');
    expect(stagePrompt(undefined)).toBe('Wrap up.');
  });
});
