export const KNOWLEDGE_MODEL_VERSION = 'bkt-v1' as const;

export const BKT_PARAMETERS = Object.freeze({
  initialMastery: 0.35,
  transition: 0.20,
  slip: 0.10,
  guess: 0.20,
  initialStabilityDays: 1.5,
  stabilityGrowth: 0.20,
  retentionTarget: 0.85,
  successThreshold: 0.80,
});

export type FormulaTraceStep = {
  step: 'prior' | 'bayesian_update' | 'learning_transition' | 'prediction';
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  inputs: Record<string, number | boolean>;
  numerator?: number;
  denominator?: number;
  value: number;
  percentageValue: number;
};

export type QuestionModelUpdate = {
  version: typeof KNOWLEDGE_MODEL_VERSION;
  parameters: typeof BKT_PARAMETERS;
  isCorrect: boolean;
  priorMastery: number;
  posteriorMastery: number;
  learningGain: number;
  currentMastery: number;
  masteryScore: number;
  predictedCorrectness: number;
  trace: FormulaTraceStep[];
};

export type ReviewSummary = {
  mastery: number;
  masteryScore: number;
  stabilityDays: number;
  successfulReviewsBefore: number;
  successfulReviewsAfter: number;
  successful: boolean;
  reviewNow: boolean;
  nextReviewAt: Date | null;
  nextReviewInDays: number | null;
  memoryNow: number;
  memoryIn6Hours: number;
  memoryIn1Day: number;
  trace: {
    mastery: DetailedFormula;
    stability: DetailedFormula;
    memory: DetailedFormula & { deltaDays: number };
    memoryIn6Hours: DetailedFormula & { deltaDays: number };
    memoryIn1Day: DetailedFormula & { deltaDays: number };
    nextReview: DetailedFormula & { valueDays: number | null };
  };
};

export type DetailedFormula = {
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  value: number | null;
  unit: 'probability' | 'percent' | 'days';
};

export type LiveQuestionCalculation = QuestionModelUpdate & {
  priorSource: 'initial_model' | 'stored_mastery' | 'previous_question';
  projection: ReviewSummary;
  projectionIsProvisional: true;
};

function assertProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be between 0 and 1.`);
  }
}

function formulaNumber(value: number): string {
  return Number(value.toFixed(10)).toString();
}

export function calculateQuestionUpdate(priorMastery: number, isCorrect: boolean): QuestionModelUpdate {
  assertProbability(priorMastery, 'priorMastery');
  const { slip, guess, transition } = BKT_PARAMETERS;
  const numerator = isCorrect ? priorMastery * (1 - slip) : priorMastery * slip;
  const denominator = isCorrect
    ? numerator + (1 - priorMastery) * guess
    : numerator + (1 - priorMastery) * (1 - guess);
  const posteriorMastery = numerator / denominator;
  const learningGain = (1 - posteriorMastery) * transition;
  const currentMastery = posteriorMastery + learningGain;
  const knownContribution = currentMastery * (1 - slip);
  const guessContribution = (1 - currentMastery) * guess;
  const predictedCorrectness = knownContribution + guessContribution;
  const evidenceFormula = isCorrect
    ? 'P(L|C) = p(1-Slip) / [p(1-Slip) + (1-p)Guess]'
    : 'P(L|W) = p×Slip / [p×Slip + (1-p)(1-Guess)]';
  const evidenceSubstitution = isCorrect
    ? `${formulaNumber(priorMastery)}×(1-${slip}) / [${formulaNumber(priorMastery)}×(1-${slip}) + (1-${formulaNumber(priorMastery)})×${guess}]`
    : `${formulaNumber(priorMastery)}×${slip} / [${formulaNumber(priorMastery)}×${slip} + (1-${formulaNumber(priorMastery)})×(1-${guess})]`;

  return {
    version: KNOWLEDGE_MODEL_VERSION,
    parameters: BKT_PARAMETERS,
    isCorrect,
    priorMastery,
    posteriorMastery,
    learningGain,
    currentMastery,
    masteryScore: currentMastery * 100,
    predictedCorrectness,
    trace: [
      {
        step: 'prior', label: 'Prior mastery', symbolic: 'p = P(Lt-1)',
        substitution: `p = ${formulaNumber(priorMastery)}`,
        calculation: `${formulaNumber(priorMastery)} = ${(priorMastery * 100).toFixed(10)}%`,
        inputs: { priorMastery }, value: priorMastery, percentageValue: priorMastery * 100,
      },
      {
        step: 'bayesian_update', label: `Bayesian update after ${isCorrect ? 'correct' : 'wrong'}`,
        symbolic: evidenceFormula, substitution: evidenceSubstitution,
        calculation: `${formulaNumber(numerator)} / ${formulaNumber(denominator)} = ${formulaNumber(posteriorMastery)}`,
        inputs: { priorMastery, slip, guess, isCorrect }, numerator, denominator,
        value: posteriorMastery, percentageValue: posteriorMastery * 100,
      },
      {
        step: 'learning_transition', label: 'Learning transition',
        symbolic: 'P(Lt) = posterior + (1-posterior)×T',
        substitution: `${formulaNumber(posteriorMastery)} + (1-${formulaNumber(posteriorMastery)})×${transition}`,
        calculation: `${formulaNumber(posteriorMastery)} + ${formulaNumber(learningGain)} = ${formulaNumber(currentMastery)}`,
        inputs: { posteriorMastery, transition, learningGain },
        value: currentMastery, percentageValue: currentMastery * 100,
      },
      {
        step: 'prediction', label: 'Predicted next correctness',
        symbolic: 'P(CorrectNext) = P(Lt)(1-Slip) + (1-P(Lt))Guess',
        substitution: `${formulaNumber(currentMastery)}×(1-${slip}) + (1-${formulaNumber(currentMastery)})×${guess}`,
        calculation: `${formulaNumber(knownContribution)} + ${formulaNumber(guessContribution)} = ${formulaNumber(predictedCorrectness)}`,
        inputs: { currentMastery, slip, guess, knownContribution, guessContribution },
        value: predictedCorrectness, percentageValue: predictedCorrectness * 100,
      },
    ],
  };
}

export function foldAnswerSequence(
  answers: readonly boolean[],
  initialMastery = BKT_PARAMETERS.initialMastery,
): QuestionModelUpdate[] {
  const updates: QuestionModelUpdate[] = [];
  let mastery: number = initialMastery;
  for (const isCorrect of answers) {
    const update = calculateQuestionUpdate(mastery, isCorrect);
    updates.push(update);
    mastery = update.currentMastery;
  }
  return updates;
}

export function calculateStability(mastery: number, successfulReviews: number): number {
  assertProbability(mastery, 'mastery');
  if (!Number.isInteger(successfulReviews) || successfulReviews < 0) {
    throw new RangeError('successfulReviews must be a non-negative integer.');
  }
  const { initialStabilityDays, stabilityGrowth, guess } = BKT_PARAMETERS;
  const base = 1 + stabilityGrowth * ((mastery - guess) / (1 - guess));
  return initialStabilityDays * (base ** successfulReviews);
}

export function calculateMemory(
  mastery: number,
  stabilityDays: number,
  lastReviewedAt: Date,
  calculatedAt = new Date(),
): number {
  assertProbability(mastery, 'mastery');
  if (!Number.isFinite(stabilityDays) || stabilityDays <= 0) {
    throw new RangeError('stabilityDays must be greater than zero.');
  }
  const deltaDays = Math.max(0, calculatedAt.getTime() - lastReviewedAt.getTime()) / 86_400_000;
  return mastery * Math.exp(-deltaDays / stabilityDays);
}

export function calculateReviewSummary(
  mastery: number,
  successfulReviewsBefore: number,
  reviewedAt: Date,
): ReviewSummary {
  assertProbability(mastery, 'mastery');
  const successful = mastery >= BKT_PARAMETERS.successThreshold;
  const successfulReviewsAfter = successful ? successfulReviewsBefore + 1 : successfulReviewsBefore;
  const stabilityDays = calculateStability(mastery, successfulReviewsAfter);
  const nextReviewInDays = successful ? -stabilityDays * Math.log(BKT_PARAMETERS.retentionTarget) : null;
  const nextReviewAt = nextReviewInDays === null ? null : new Date(reviewedAt.getTime() + nextReviewInDays * 86_400_000);
  const memoryNow = calculateMemory(mastery, stabilityDays, reviewedAt, reviewedAt);
  const memoryIn6Hours = calculateMemory(mastery, stabilityDays, reviewedAt, new Date(reviewedAt.getTime() + 21_600_000));
  const memoryIn1Day = calculateMemory(mastery, stabilityDays, reviewedAt, new Date(reviewedAt.getTime() + 86_400_000));
  const { initialStabilityDays, stabilityGrowth, guess, retentionTarget } = BKT_PARAMETERS;
  const normalizedMastery = (mastery - guess) / (1 - guess);
  const growthAdjustment = stabilityGrowth * normalizedMastery;
  const stabilityBase = 1 + growthAdjustment;
  const stabilityPower = stabilityBase ** successfulReviewsAfter;
  const memoryTrace = (label: string, deltaDays: number, value: number) => ({
    label,
    symbolic: 'Memory(t) = Mastery × exp(-Δt/Stability)',
    substitution: `${formulaNumber(mastery)} × exp(-${formulaNumber(deltaDays)}/${formulaNumber(stabilityDays)})`,
    calculation: `${formulaNumber(mastery)} × ${formulaNumber(Math.exp(-deltaDays / stabilityDays))} = ${formulaNumber(value)} = ${(value * 100).toFixed(10)}%`,
    value,
    unit: 'probability' as const,
    deltaDays,
  });

  return {
    mastery, masteryScore: mastery * 100, stabilityDays,
    successfulReviewsBefore, successfulReviewsAfter, successful,
    reviewNow: !successful, nextReviewAt, nextReviewInDays,
    memoryNow, memoryIn6Hours, memoryIn1Day,
    trace: {
      mastery: {
        label: 'Mastery score',
        symbolic: 'Mastery Score = 100 × P(Lt)',
        substitution: `100 × ${formulaNumber(mastery)}`,
        calculation: `${(mastery * 100).toFixed(10)}%`,
        value: mastery * 100,
        unit: 'percent',
      },
      stability: {
        label: 'Stability',
        symbolic: 'S = S0 × [1 + k × (P(Lt)-Guess)/(1-Guess)]^n',
        substitution: `${initialStabilityDays} × [1 + ${stabilityGrowth} × (${formulaNumber(mastery)}-${guess})/(1-${guess})]^${successfulReviewsAfter}`,
        calculation: `${initialStabilityDays} × [1 + ${formulaNumber(growthAdjustment)}]^${successfulReviewsAfter} = ${initialStabilityDays} × ${formulaNumber(stabilityPower)} = ${formulaNumber(stabilityDays)} days`,
        value: stabilityDays,
        unit: 'days',
      },
      memory: memoryTrace('Memory now', 0, memoryNow),
      memoryIn6Hours: memoryTrace('Memory after 6 hours', 0.25, memoryIn6Hours),
      memoryIn1Day: memoryTrace('Memory after 1 day', 1, memoryIn1Day),
      nextReview: {
        label: successful ? 'Next review delay' : 'Immediate review trigger',
        symbolic: successful ? 'Δt = -S × ln(retentionTarget)' : 'Mastery < 0.80 → Review Now',
        substitution: successful ? `-${formulaNumber(stabilityDays)} × ln(${retentionTarget})` : `${formulaNumber(mastery)} < ${BKT_PARAMETERS.successThreshold}`,
        calculation: successful
          ? `-${formulaNumber(stabilityDays)} × ${formulaNumber(Math.log(retentionTarget))} = ${formulaNumber(nextReviewInDays!)} days`
          : `${(mastery * 100).toFixed(10)}% < ${(BKT_PARAMETERS.successThreshold * 100).toFixed(2)}% → Review Now`,
        value: nextReviewInDays,
        unit: 'days',
        valueDays: nextReviewInDays,
      },
    },
  };
}

export function calculateLiveQuestion(
  priorMastery: number,
  isCorrect: boolean,
  priorSource: LiveQuestionCalculation['priorSource'],
  successfulReviewsBefore: number,
  answeredAt: Date,
): LiveQuestionCalculation {
  const update = calculateQuestionUpdate(priorMastery, isCorrect);
  return {
    ...update,
    priorSource,
    projection: calculateReviewSummary(update.currentMastery, successfulReviewsBefore, answeredAt),
    projectionIsProvisional: true,
  };
}

export function calculateDynamicProgress(
  mastery: number,
  stabilityDays: number,
  lastReviewedAt: Date,
  calculatedAt = new Date(),
) {
  const memory = calculateMemory(mastery, stabilityDays, lastReviewedAt, calculatedAt);
  const reviewNow = mastery < BKT_PARAMETERS.successThreshold;
  const nextReviewInDays = reviewNow ? null : -stabilityDays * Math.log(BKT_PARAMETERS.retentionTarget);
  return {
    memory,
    memoryScore: memory * 100,
    masteryScore: mastery * 100,
    reviewNow,
    nextReviewAt: nextReviewInDays === null ? null : new Date(lastReviewedAt.getTime() + nextReviewInDays * 86_400_000),
    calculatedAt,
  };
}
