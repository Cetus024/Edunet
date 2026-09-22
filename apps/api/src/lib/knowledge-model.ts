export const KNOWLEDGE_MODEL_VERSION = 'phase1-v1' as const;

export const PHASE1_PARAMETERS = Object.freeze({
  initialMastery: 0.35,
  transition: 0.20,
  mcqSlip: 0.20,
  mcqGuess: 0.25,
  mcqEvidenceStrength: 0.30,
  essaySlip: 0.15,
  essayGuess: 0.05,
  stabilityDays: 7.83,
  memoryThreshold: 0.60,
  maximumReminderDays: 4,
});

export type AssessmentMode = 'mcq' | 'essay';

export type FormulaSymbol = {
  symbol: string;
  meaning: string;
  value?: number;
  unit?: 'probability' | 'percent' | 'days' | 'count' | 'marks';
};

export type FormulaTraceStep = {
  step: 'prior_decay' | 'likelihood_known' | 'likelihood_unknown' | 'bayesian_update' | 'learning_transition';
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  explanation: string;
  symbols: FormulaSymbol[];
  value: number;
  percentageValue?: number;
};

export type ModeCalculation = {
  version: typeof KNOWLEDGE_MODEL_VERSION;
  parameters: typeof PHASE1_PARAMETERS;
  mode: AssessmentMode;
  previousMastery: number;
  elapsedDays: number;
  priorMastery: number;
  observationScore: number;
  evidenceKnown: number;
  evidenceUnknown: number;
  posteriorMastery: number;
  transitionUsed: number;
  learningGain: number;
  currentMastery: number;
  masteryScore: number;
  trace: FormulaTraceStep[];
  mcq?: { correct: number; wrong: number; total: number };
  essay?: { marksObtained: number; maximumMarks: number };
};

export type ModeProgressInput = {
  mode: AssessmentMode;
  mastery: number;
  lastUpdatedAt: Date;
  quizAttempts?: number;
};

export type ModeMemory = ModeProgressInput & {
  elapsedDays: number;
  memory: number;
  memoryScore: number;
  masteryScore: number;
};

export type ConceptMemorySummary = {
  calculatedAt: Date;
  modes: { mcq: ModeMemory | null; essay: ModeMemory | null };
  conceptMemory: number | null;
  conceptMemoryScore: number | null;
  recommendedMode: AssessmentMode | null;
  reviewNow: boolean;
};

export type ReminderSummary = {
  reviewNow: boolean;
  rawDays: number;
  reviewInDays: number;
  nextReviewAt: Date;
};

function assertProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1.`);
  }
}

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(`${name} must be non-negative.`);
}

export function formatFormulaNumber(value: number): string {
  return value.toFixed(4);
}

export function elapsedDaysBetween(previous: Date, current: Date): number {
  return Math.max(0, current.getTime() - previous.getTime()) / 86_400_000;
}

export function decayMastery(previousMastery: number, elapsedDays: number): number {
  assertProbability(previousMastery, 'previousMastery');
  assertNonNegative(elapsedDays, 'elapsedDays');
  return previousMastery * Math.exp(-elapsedDays / PHASE1_PARAMETERS.stabilityDays);
}

function calculateModeResult(input: {
  mode: AssessmentMode;
  previousMastery: number;
  elapsedDays: number;
  observationScore: number;
  evidenceKnown: number;
  evidenceUnknown: number;
  transitionUsed: number;
  mcq?: ModeCalculation['mcq'];
  essay?: ModeCalculation['essay'];
}): ModeCalculation {
  const priorMastery = decayMastery(input.previousMastery, input.elapsedDays);
  const numerator = priorMastery * input.evidenceKnown;
  const denominator = numerator + (1 - priorMastery) * input.evidenceUnknown;
  const posteriorMastery = denominator === 0 ? priorMastery : numerator / denominator;
  const learningGain = (1 - posteriorMastery) * input.transitionUsed;
  const currentMastery = posteriorMastery + learningGain;
  const decayMultiplier = Math.exp(-input.elapsedDays / PHASE1_PARAMETERS.stabilityDays);
  const knownSymbolic = input.mode === 'mcq'
    ? 'A_MC = [(1-Slip_MC)^c × Slip_MC^w]^λ'
    : 'A_E = (1-Slip_E)^q × Slip_E^(1-q)';
  const unknownSymbolic = input.mode === 'mcq'
    ? 'B_MC = [Guess_MC^c × (1-Guess_MC)^w]^λ'
    : 'B_E = Guess_E^q × (1-Guess_E)^(1-q)';

  return {
    version: KNOWLEDGE_MODEL_VERSION,
    parameters: PHASE1_PARAMETERS,
    mode: input.mode,
    previousMastery: input.previousMastery,
    elapsedDays: input.elapsedDays,
    priorMastery,
    observationScore: input.observationScore,
    evidenceKnown: input.evidenceKnown,
    evidenceUnknown: input.evidenceUnknown,
    posteriorMastery,
    transitionUsed: input.transitionUsed,
    learningGain,
    currentMastery,
    masteryScore: currentMastery * 100,
    ...(input.mcq ? { mcq: input.mcq } : {}),
    ...(input.essay ? { essay: input.essay } : {}),
    trace: [
      {
        step: 'prior_decay',
        label: 'Time-decayed prior mastery',
        symbolic: 'P(L_prior) = P(L_previous) × exp(-Δt/S)',
        substitution: `${formatFormulaNumber(input.previousMastery)} × exp(-${formatFormulaNumber(input.elapsedDays)}/${formatFormulaNumber(PHASE1_PARAMETERS.stabilityDays)})`,
        calculation: `${formatFormulaNumber(input.previousMastery)} × ${formatFormulaNumber(decayMultiplier)} = ${formatFormulaNumber(priorMastery)}`,
        explanation: input.elapsedDays === 0
          ? 'No time decay is needed; the saved mastery or the initial P(L0)=0.35 is used as this assessment\'s fixed prior.'
          : 'Previous mastery is decayed before new assessment evidence is applied.',
        symbols: [
          { symbol: 'P(L_previous)', meaning: 'Mastery saved after the previous assessment or correction.', value: input.previousMastery, unit: 'probability' },
          { symbol: 'Δt', meaning: 'Days since this mode was last updated.', value: input.elapsedDays, unit: 'days' },
          { symbol: 'S', meaning: 'Fixed Phase 1 memory stability.', value: PHASE1_PARAMETERS.stabilityDays, unit: 'days' },
        ],
        value: priorMastery,
        percentageValue: priorMastery * 100,
      },
      {
        step: 'likelihood_known',
        label: 'Likelihood if the concept is known',
        symbolic: knownSymbolic,
        substitution: input.mode === 'mcq'
          ? `[(1-${formatFormulaNumber(PHASE1_PARAMETERS.mcqSlip)})^${input.mcq!.correct} × ${formatFormulaNumber(PHASE1_PARAMETERS.mcqSlip)}^${input.mcq!.wrong}]^${formatFormulaNumber(PHASE1_PARAMETERS.mcqEvidenceStrength)}`
          : `(1-${formatFormulaNumber(PHASE1_PARAMETERS.essaySlip)})^${formatFormulaNumber(input.observationScore)} × ${formatFormulaNumber(PHASE1_PARAMETERS.essaySlip)}^(1-${formatFormulaNumber(input.observationScore)})`,
        calculation: `A = ${formatFormulaNumber(input.evidenceKnown)}`,
        explanation: 'Measures how compatible the complete result is with a learner who knows the concept.',
        symbols: input.mode === 'mcq'
          ? [
              { symbol: 'c', meaning: 'Correct MCQ answers.', value: input.mcq!.correct, unit: 'count' },
              { symbol: 'w', meaning: 'Wrong MCQ answers.', value: input.mcq!.wrong, unit: 'count' },
              { symbol: 'λ', meaning: 'MCQ evidence-strength control.', value: PHASE1_PARAMETERS.mcqEvidenceStrength },
            ]
          : [{ symbol: 'q', meaning: 'Essay marks divided by maximum marks.', value: input.observationScore, unit: 'probability' }],
        value: input.evidenceKnown,
      },
      {
        step: 'likelihood_unknown',
        label: 'Likelihood if the concept is not known',
        symbolic: unknownSymbolic,
        substitution: input.mode === 'mcq'
          ? `[${formatFormulaNumber(PHASE1_PARAMETERS.mcqGuess)}^${input.mcq!.correct} × (1-${formatFormulaNumber(PHASE1_PARAMETERS.mcqGuess)})^${input.mcq!.wrong}]^${formatFormulaNumber(PHASE1_PARAMETERS.mcqEvidenceStrength)}`
          : `${formatFormulaNumber(PHASE1_PARAMETERS.essayGuess)}^${formatFormulaNumber(input.observationScore)} × (1-${formatFormulaNumber(PHASE1_PARAMETERS.essayGuess)})^(1-${formatFormulaNumber(input.observationScore)})`,
        calculation: `B = ${formatFormulaNumber(input.evidenceUnknown)}`,
        explanation: 'Measures how compatible the complete result is with guessing or partial performance without mastery.',
        symbols: input.mode === 'mcq'
          ? [{ symbol: 'Guess_MC', meaning: 'Chance of a correct four-choice guess.', value: PHASE1_PARAMETERS.mcqGuess, unit: 'probability' }]
          : [{ symbol: 'Guess_E', meaning: 'Chance of earning Essay marks without mastery.', value: PHASE1_PARAMETERS.essayGuess, unit: 'probability' }],
        value: input.evidenceUnknown,
      },
      {
        step: 'bayesian_update',
        label: 'Bayesian observation update',
        symbolic: 'P(L|result) = prior×A / [prior×A + (1-prior)×B]',
        substitution: `${formatFormulaNumber(priorMastery)}×${formatFormulaNumber(input.evidenceKnown)} / [${formatFormulaNumber(priorMastery)}×${formatFormulaNumber(input.evidenceKnown)} + (1-${formatFormulaNumber(priorMastery)})×${formatFormulaNumber(input.evidenceUnknown)}]`,
        calculation: `${formatFormulaNumber(numerator)} / ${formatFormulaNumber(denominator)} = ${formatFormulaNumber(posteriorMastery)}`,
        explanation: 'Combines the decayed prior with the evidence from the complete assessment.',
        symbols: [
          { symbol: 'A', meaning: 'Likelihood when the concept is known.', value: input.evidenceKnown },
          { symbol: 'B', meaning: 'Likelihood when the concept is not known.', value: input.evidenceUnknown },
        ],
        value: posteriorMastery,
        percentageValue: posteriorMastery * 100,
      },
      {
        step: 'learning_transition',
        label: input.transitionUsed > 0 ? 'Learning after completed corrections' : 'Assessment-only result',
        symbolic: 'P(L_new) = posterior + (1-posterior) × P(T_used)',
        substitution: `${formatFormulaNumber(posteriorMastery)} + (1-${formatFormulaNumber(posteriorMastery)}) × ${formatFormulaNumber(input.transitionUsed)}`,
        calculation: `${formatFormulaNumber(posteriorMastery)} + ${formatFormulaNumber(learningGain)} = ${formatFormulaNumber(currentMastery)}`,
        explanation: input.transitionUsed > 0
          ? 'P(T)=0.20 is applied exactly once after corrections are explicitly completed.'
          : 'P(T)=0 while this is assessment-only; the evidence update still becomes the saved mastery.',
        symbols: [{ symbol: 'P(T_used)', meaning: 'Learning transition used for this result.', value: input.transitionUsed, unit: 'probability' }],
        value: currentMastery,
        percentageValue: currentMastery * 100,
      },
    ],
  };
}

export function calculateMcqMastery(input: {
  previousMastery?: number;
  elapsedDays?: number;
  correct: number;
  wrong: number;
  feedbackCompleted?: boolean;
}): ModeCalculation {
  const previousMastery = input.previousMastery ?? PHASE1_PARAMETERS.initialMastery;
  const elapsedDays = input.elapsedDays ?? 0;
  if (!Number.isInteger(input.correct) || !Number.isInteger(input.wrong) || input.correct < 0 || input.wrong < 0 || input.correct + input.wrong <= 0) {
    throw new RangeError('MCQ correct and wrong counts must be non-negative integers with a positive total.');
  }
  const { mcqSlip: slip, mcqGuess: guess, mcqEvidenceStrength: lambda } = PHASE1_PARAMETERS;
  const evidenceKnown = (((1 - slip) ** input.correct) * (slip ** input.wrong)) ** lambda;
  const evidenceUnknown = ((guess ** input.correct) * ((1 - guess) ** input.wrong)) ** lambda;
  return calculateModeResult({
    mode: 'mcq', previousMastery, elapsedDays,
    observationScore: input.correct / (input.correct + input.wrong),
    evidenceKnown, evidenceUnknown,
    transitionUsed: input.feedbackCompleted ? PHASE1_PARAMETERS.transition : 0,
    mcq: { correct: input.correct, wrong: input.wrong, total: input.correct + input.wrong },
  });
}

export function calculateEssayMastery(input: {
  previousMastery?: number;
  elapsedDays?: number;
  marksObtained: number;
  maximumMarks: number;
  feedbackCompleted?: boolean;
}): ModeCalculation {
  const previousMastery = input.previousMastery ?? PHASE1_PARAMETERS.initialMastery;
  const elapsedDays = input.elapsedDays ?? 0;
  assertNonNegative(input.marksObtained, 'marksObtained');
  if (!Number.isFinite(input.maximumMarks) || input.maximumMarks <= 0 || input.marksObtained > input.maximumMarks) {
    throw new RangeError('Essay marks must be between zero and the positive maximum mark.');
  }
  const q = input.marksObtained / input.maximumMarks;
  const { essaySlip: slip, essayGuess: guess } = PHASE1_PARAMETERS;
  const evidenceKnown = ((1 - slip) ** q) * (slip ** (1 - q));
  const evidenceUnknown = (guess ** q) * ((1 - guess) ** (1 - q));
  return calculateModeResult({
    mode: 'essay', previousMastery, elapsedDays, observationScore: q,
    evidenceKnown, evidenceUnknown,
    transitionUsed: input.feedbackCompleted ? PHASE1_PARAMETERS.transition : 0,
    essay: { marksObtained: input.marksObtained, maximumMarks: input.maximumMarks },
  });
}

export function calculateMemory(mastery: number, lastUpdatedAt: Date, calculatedAt = new Date()): number {
  return decayMastery(mastery, elapsedDaysBetween(lastUpdatedAt, calculatedAt));
}

export function calculateConceptMemory(
  progress: readonly ModeProgressInput[],
  calculatedAt = new Date(),
): ConceptMemorySummary {
  const memories = progress.map((entry): ModeMemory => {
    const elapsedDays = elapsedDaysBetween(entry.lastUpdatedAt, calculatedAt);
    const memory = decayMastery(entry.mastery, elapsedDays);
    return { ...entry, elapsedDays, memory, memoryScore: memory * 100, masteryScore: entry.mastery * 100 };
  });
  const mcq = memories.find((entry) => entry.mode === 'mcq') ?? null;
  const essay = memories.find((entry) => entry.mode === 'essay') ?? null;
  const available = [mcq, essay].filter((entry): entry is ModeMemory => entry !== null);
  const conceptMemory = available.length === 0
    ? null
    : available.reduce((sum, entry) => sum + entry.memory, 0) / available.length;
  let recommendedMode: AssessmentMode | null = null;
  if (mcq && essay) recommendedMode = mcq.memory <= essay.memory ? 'mcq' : 'essay';
  else recommendedMode = mcq?.mode ?? essay?.mode ?? null;
  return {
    calculatedAt,
    modes: { mcq, essay },
    conceptMemory,
    conceptMemoryScore: conceptMemory === null ? null : conceptMemory * 100,
    recommendedMode,
    reviewNow: conceptMemory !== null && conceptMemory <= PHASE1_PARAMETERS.memoryThreshold,
  };
}

export function calculateReminder(conceptMemory: number, calculatedAt = new Date()): ReminderSummary {
  assertProbability(conceptMemory, 'conceptMemory');
  if (conceptMemory <= PHASE1_PARAMETERS.memoryThreshold) {
    return { reviewNow: true, rawDays: 0, reviewInDays: 0, nextReviewAt: calculatedAt };
  }
  const rawDays = PHASE1_PARAMETERS.stabilityDays * Math.log(conceptMemory / PHASE1_PARAMETERS.memoryThreshold);
  const reviewInDays = Math.min(PHASE1_PARAMETERS.maximumReminderDays, Math.ceil(rawDays));
  return {
    reviewNow: false,
    rawDays,
    reviewInDays,
    nextReviewAt: new Date(calculatedAt.getTime() + reviewInDays * 86_400_000),
  };
}
