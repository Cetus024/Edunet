import type { SubconceptSeed } from '@/features/concept-web/content';
import type { SubconceptCoverage } from '@/lib/discussion-rubric';

/**
 * The mediator: decides when to say something, and what.
 *
 * Deliberately model-free. Every decision here comes from signals that cost
 * nothing to compute — silence, elapsed time, repetition, coverage — so the
 * mediator works offline, instantly, and identically every run. When a model is
 * wired in later it should replace the *wording*, not the timing: an LLM asked
 * every second whether to speak is expensive, slow and unpredictable, while
 * these rules are none of those.
 *
 * The other half is structure. "Explain Rivers" is a blank page, and a blank
 * page is why a real transcript came back naming three subconcepts and
 * explaining none of them. One subconcept at a time turns that into three small
 * questions, which is a different task.
 */

export const STAGE_SECONDS = 60;
/** Long enough not to interrupt someone thinking; short enough to rescue someone stuck. */
export const SILENCE_NUDGE_SECONDS = 8;
/** Past this much of a stage with nothing landing, a hint beats more silence. */
export const HINT_AFTER_SECONDS = 35;

export type CueKind = 'prompt' | 'nudge' | 'hint' | 'repeat' | 'advance' | 'done';

export type MediatorCue = {
  kind: CueKind;
  text: string;
};

export type MediatorInput = {
  subconcepts: readonly SubconceptSeed[];
  coverage: readonly SubconceptCoverage[];
  stageIndex: number;
  /** Seconds spent on the current subconcept. */
  elapsedInStage: number;
  /** Seconds since the microphone last heard anything above the noise floor. */
  silenceSeconds: number;
  /** A phrase the speaker has just repeated, if any. */
  repeatedPhrase: string | null;
};

function verdictFor(coverage: readonly SubconceptCoverage[], id: string) {
  return coverage.find((entry) => entry.id === id)?.verdict ?? 'missed';
}

/**
 * Picks the single thing worth saying right now, or nothing.
 *
 * Order matters: moving on when a point is made beats nudging, and nudging
 * someone who has gone quiet beats hinting at content they may be about to
 * reach on their own. Returning null is the common case and is the point —
 * a mediator that talks constantly is worse than none.
 */
export function nextCue(input: MediatorInput): MediatorCue | null {
  const current = input.subconcepts[input.stageIndex];
  if (!current) return { kind: 'done', text: 'That is all three. Finishing up.' };

  if (verdictFor(input.coverage, current.id) === 'covered') {
    const next = input.subconcepts[input.stageIndex + 1];
    return {
      kind: 'advance',
      text: next
        ? `Good — that covers ${current.name}. Now tell me about ${next.name}.`
        : `Good — that covers ${current.name}. That is all three.`,
    };
  }

  if (input.silenceSeconds >= SILENCE_NUDGE_SECONDS) {
    return {
      kind: 'nudge',
      text: `Still thinking? Start anywhere — what does ${current.name} mean in your own words?`,
    };
  }

  if (input.repeatedPhrase) {
    return {
      kind: 'repeat',
      text: `You have said that already. What happens next, after ${input.repeatedPhrase}?`,
    };
  }

  if (input.elapsedInStage >= HINT_AFTER_SECONDS) {
    return { kind: 'hint', text: `A steer: ${current.description}` };
  }

  return null;
}

/** The standing question for a stage, shown whether or not the mediator is speaking. */
export function stagePrompt(subconcept: SubconceptSeed | undefined): string {
  return subconcept ? `Explain ${subconcept.name}.` : 'Wrap up.';
}

export function shouldAdvance(input: MediatorInput): boolean {
  const current = input.subconcepts[input.stageIndex];
  if (!current) return false;
  return verdictFor(input.coverage, current.id) === 'covered'
    || input.elapsedInStage >= STAGE_SECONDS;
}

/**
 * Finds a phrase the speaker has just repeated.
 *
 * Someone who has run out of things to say circles the same clause rather than
 * falling silent, so silence detection alone misses it. Only the recent tail is
 * examined — a phrase legitimately reused a minute apart is not stalling.
 */
export function findRepeatedPhrase(transcript: string, windowWords = 40): string | null {
  const words = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  const recent = words.slice(-windowWords);
  if (recent.length < 10) return null;

  const size = 4;
  const seen = new Map<string, number>();
  for (let index = 0; index + size <= recent.length; index += 1) {
    const phrase = recent.slice(index, index + size).join(' ');
    const count = (seen.get(phrase) ?? 0) + 1;
    if (count >= 2) return phrase;
    seen.set(phrase, count);
  }
  return null;
}
