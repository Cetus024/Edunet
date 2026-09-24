export type DrawingPoint = { x: number; y: number };
export type DrawingStroke = { color: string; width: number; points: DrawingPoint[] };
export type WorkAnalysis = {
  verdict: 'looks_consistent' | 'needs_revision' | 'needs_clarification';
  summary: string;
  steps: Array<{ quote: string; status: 'consistent' | 'error' | 'uncertain'; explanation: string }>;
  conceptConflicts: Array<{ quote: string; concept: string; explanation: string }>;
  limitations: string[];
  options: Array<{ label: string; explanation: string }>;
};
export type LearningWork = {
  id: string;
  userId: string;
  displayName: string;
  question: string;
  transcript: string;
  strokes: DrawingStroke[];
  analysis: WorkAnalysis;
  createdAt: string;
  questionIndex: number;
  runNumber: number;
};
export type WorkInput = {
  submissionId: string;
  question: string;
  transcript: string;
  strokes: DrawingStroke[];
  questionIndex: number;
  runNumber: number;
  locale: 'en' | 'zh';
};

export type WorkScore = {
  score: number;
  consistentSteps: number;
  totalSteps: number;
  conflictPenalty: number;
};

// Credit per step status. An uncertain step is half credit rather than zero:
// the analysis says it could not verify the step, which is not the same as
// the student getting it wrong, and scoring it as wrong would punish messy
// handwriting rather than bad reasoning.
const STEP_CREDIT: Record<WorkAnalysis['steps'][number]['status'], number> = {
  consistent: 1,
  uncertain: 0.5,
  error: 0,
};

const CONFLICT_PENALTY = 8;
const MAX_CONFLICT_PENALTY = 32;

// A verdict of "needs revision" alongside all-consistent steps is a genuine
// contradiction the model can produce. Capping by verdict keeps the number
// from claiming a perfect solution the analysis itself disputes.
const VERDICT_CEILING: Record<WorkAnalysis['verdict'], number> = {
  looks_consistent: 100,
  needs_clarification: 80,
  needs_revision: 65,
};

// Scores with no steps to count at all -- the model returned only a verdict.
const VERDICT_ONLY_SCORE: Record<WorkAnalysis['verdict'], number> = {
  looks_consistent: 80,
  needs_clarification: 50,
  needs_revision: 30,
};

/**
 * Turns a stored WorkAnalysis into a 0-100 score for the whiteboard work.
 *
 * Derived from the analysis that is already persisted rather than asked of
 * the model, so it is deterministic, explainable to the student ("you had 4
 * of 6 steps consistent"), and applies retroactively to every submission
 * already in the database.
 */
export function scoreWorkAnalysis(analysis: WorkAnalysis): WorkScore {
  const steps = analysis.steps ?? [];
  const conflicts = analysis.conceptConflicts ?? [];
  const conflictPenalty = Math.min(conflicts.length * CONFLICT_PENALTY, MAX_CONFLICT_PENALTY);
  const consistentSteps = steps.filter((step) => step.status === 'consistent').length;

  if (steps.length === 0) {
    return {
      score: Math.max(0, VERDICT_ONLY_SCORE[analysis.verdict] - conflictPenalty),
      consistentSteps: 0,
      totalSteps: 0,
      conflictPenalty,
    };
  }

  const credit = steps.reduce((sum, step) => sum + (STEP_CREDIT[step.status] ?? 0), 0);
  const raw = (credit / steps.length) * 100 - conflictPenalty;
  const score = Math.round(Math.max(0, Math.min(VERDICT_CEILING[analysis.verdict], raw)));
  return { score, consistentSteps, totalSteps: steps.length, conflictPenalty };
}
