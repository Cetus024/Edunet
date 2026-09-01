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

export type FormulaSymbol = {
  symbol: string;
  meaning: string;
  value?: number;
  unit?: 'probability' | 'percent' | 'days' | 'count';
};

export type FormulaTraceStep = {
  step: 'prior' | 'bayesian_update' | 'learning_transition' | 'prediction';
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  explanation: string;
  symbols: FormulaSymbol[];
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
  explanation: string;
  symbols: FormulaSymbol[];
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

export function formatFormulaNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
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
    ? `${formatFormulaNumber(priorMastery)}×(1-${formatFormulaNumber(slip)}) / [${formatFormulaNumber(priorMastery)}×(1-${formatFormulaNumber(slip)}) + (1-${formatFormulaNumber(priorMastery)})×${formatFormulaNumber(guess)}]`
    : `${formatFormulaNumber(priorMastery)}×${formatFormulaNumber(slip)} / [${formatFormulaNumber(priorMastery)}×${formatFormulaNumber(slip)} + (1-${formatFormulaNumber(priorMastery)})×(1-${formatFormulaNumber(guess)})]`;
  const evidenceExplanation = isCorrect
    ? 'Uses the correct answer as evidence to estimate how likely the learner was already in the learned state.'
    : 'Uses the wrong answer as evidence to estimate how likely the learner was still in the learned state despite a possible slip.';
  const evidenceSymbols: FormulaSymbol[] = [
    { symbol: 'L', meaning: 'The learner is in the learned state.' },
    { symbol: isCorrect ? 'C' : 'W', meaning: isCorrect ? 'The observed answer is correct.' : 'The observed answer is wrong.' },
    { symbol: 'p', meaning: 'Prior mastery probability before this answer.', value: priorMastery, unit: 'probability' },
    { symbol: 'Slip', meaning: 'Probability of answering incorrectly despite knowing the skill.', value: slip, unit: 'probability' },
    { symbol: 'Guess', meaning: 'Probability of answering correctly without knowing the skill.', value: guess, unit: 'probability' },
  ];

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
        substitution: `p = ${formatFormulaNumber(priorMastery)}`,
        calculation: `${formatFormulaNumber(priorMastery)} = ${formatFormulaNumber(priorMastery * 100)}%`,
        explanation: 'Shows the model\'s estimate of mastery immediately before the current answer is observed.',
        symbols: [
          { symbol: 'p', meaning: 'The prior mastery probability.', value: priorMastery, unit: 'probability' },
          { symbol: 'P', meaning: 'Probability of an event.' },
          { symbol: 'L', meaning: 'The learner is in the learned state.' },
          { symbol: 't-1', meaning: 'The state immediately before the current question.' },
        ],
        inputs: { priorMastery }, value: priorMastery, percentageValue: priorMastery * 100,
      },
      {
        step: 'bayesian_update', label: `Bayesian update after ${isCorrect ? 'correct' : 'wrong'}`,
        symbolic: evidenceFormula, substitution: evidenceSubstitution,
        calculation: `${formatFormulaNumber(numerator)} / ${formatFormulaNumber(denominator)} = ${formatFormulaNumber(posteriorMastery)}`,
        explanation: evidenceExplanation,
        symbols: evidenceSymbols,
        inputs: { priorMastery, slip, guess, isCorrect }, numerator, denominator,
        value: posteriorMastery, percentageValue: posteriorMastery * 100,
      },
      {
        step: 'learning_transition', label: 'Learning transition',
        symbolic: 'P(Lt) = posterior + (1-posterior)×T',
        substitution: `${formatFormulaNumber(posteriorMastery)} + (1-${formatFormulaNumber(posteriorMastery)})×${formatFormulaNumber(transition)}`,
        calculation: `${formatFormulaNumber(posteriorMastery)} + ${formatFormulaNumber(learningGain)} = ${formatFormulaNumber(currentMastery)}`,
        explanation: 'Adds the chance that the learner acquired the skill from this learning opportunity after the answer was observed.',
        symbols: [
          { symbol: 'P(Lt)', meaning: 'Mastery probability after the current learning opportunity.', value: currentMastery, unit: 'probability' },
          { symbol: 'posterior', meaning: 'Mastery probability after the Bayesian evidence update.', value: posteriorMastery, unit: 'probability' },
          { symbol: 'T', meaning: 'Probability of learning the skill during this opportunity.', value: transition, unit: 'probability' },
        ],
        inputs: { posteriorMastery, transition, learningGain },
        value: currentMastery, percentageValue: currentMastery * 100,
      },
      {
        step: 'prediction', label: 'Predicted next correctness',
        symbolic: 'P(CorrectNext) = P(Lt)(1-Slip) + (1-P(Lt))Guess',
        substitution: `${formatFormulaNumber(currentMastery)}×(1-${formatFormulaNumber(slip)}) + (1-${formatFormulaNumber(currentMastery)})×${formatFormulaNumber(guess)}`,
        calculation: `${formatFormulaNumber(knownContribution)} + ${formatFormulaNumber(guessContribution)} = ${formatFormulaNumber(predictedCorrectness)}`,
        explanation: 'Combines the chance of a learned student answering without slipping and an unlearned student guessing correctly.',
        symbols: [
          { symbol: 'CorrectNext', meaning: 'The next answer is correct.' },
          { symbol: 'P(Lt)', meaning: 'Current mastery probability after learning transition.', value: currentMastery, unit: 'probability' },
          { symbol: 'Slip', meaning: 'Probability of answering incorrectly despite knowing the skill.', value: slip, unit: 'probability' },
          { symbol: 'Guess', meaning: 'Probability of answering correctly without knowing the skill.', value: guess, unit: 'probability' },
        ],
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
    substitution: `${formatFormulaNumber(mastery)} × exp(-${formatFormulaNumber(deltaDays)}/${formatFormulaNumber(stabilityDays)})`,
    calculation: `${formatFormulaNumber(mastery)} × ${formatFormulaNumber(Math.exp(-deltaDays / stabilityDays))} = ${formatFormulaNumber(value)} = ${formatFormulaNumber(value * 100)}%`,
    explanation: 'Projects retained accessible memory by applying exponential decay to the current mastery estimate over elapsed time.',
    symbols: [
      { symbol: 'Memory(t)', meaning: 'Projected retained memory at time t.', value, unit: 'probability' as const },
      { symbol: 'Mastery', meaning: 'Mastery probability at the latest review.', value: mastery, unit: 'probability' as const },
      { symbol: 'exp', meaning: 'The exponential function.' },
      { symbol: 'Δt', meaning: 'Elapsed time since the latest review, measured in days.', value: deltaDays, unit: 'days' as const },
      { symbol: 'Stability', meaning: 'The current forgetting-curve time scale, measured in days.', value: stabilityDays, unit: 'days' as const },
    ],
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
        substitution: `100 × ${formatFormulaNumber(mastery)}`,
        calculation: `${formatFormulaNumber(mastery * 100)}%`,
        explanation: 'Converts the current mastery probability into the percentage shown to the learner.',
        symbols: [
          { symbol: 'P(Lt)', meaning: 'Current mastery probability after the latest learning transition.', value: mastery, unit: 'probability' },
        ],
        value: mastery * 100,
        unit: 'percent',
      },
      stability: {
        label: 'Stability',
        symbolic: 'S = S0 × [1 + k × (P(Lt)-Guess)/(1-Guess)]^n',
        substitution: `${formatFormulaNumber(initialStabilityDays)} × [1 + ${formatFormulaNumber(stabilityGrowth)} × (${formatFormulaNumber(mastery)}-${formatFormulaNumber(guess)})/(1-${formatFormulaNumber(guess)})]^${successfulReviewsAfter}`,
        calculation: `${formatFormulaNumber(initialStabilityDays)} × [1 + ${formatFormulaNumber(growthAdjustment)}]^${successfulReviewsAfter} = ${formatFormulaNumber(initialStabilityDays)} × ${formatFormulaNumber(stabilityPower)} = ${formatFormulaNumber(stabilityDays)} days`,
        explanation: 'Estimates how slowly memory should decay from normalized mastery and the number of successful reviews.',
        symbols: [
          { symbol: 'S', meaning: 'Calculated stability in days.', value: stabilityDays, unit: 'days' },
          { symbol: 'S0', meaning: 'Initial stability before successful-review growth.', value: initialStabilityDays, unit: 'days' },
          { symbol: 'k', meaning: 'Growth strength applied at each successful review.', value: stabilityGrowth },
          { symbol: 'P(Lt)', meaning: 'Current mastery probability.', value: mastery, unit: 'probability' },
          { symbol: 'Guess', meaning: 'Guess probability used as the baseline mastery level.', value: guess, unit: 'probability' },
          { symbol: 'n', meaning: 'Number of successful reviews after applying this result.', value: successfulReviewsAfter, unit: 'count' },
        ],
        value: stabilityDays,
        unit: 'days',
      },
      memory: memoryTrace('Memory now', 0, memoryNow),
      memoryIn6Hours: memoryTrace('Memory after 6 hours', 0.25, memoryIn6Hours),
      memoryIn1Day: memoryTrace('Memory after 1 day', 1, memoryIn1Day),
      nextReview: {
        label: successful ? 'Next review delay' : 'Immediate review trigger',
        symbolic: successful ? 'Δt = -S × ln(retentionTarget)' : 'Mastery < 0.8 → Review Now',
        substitution: successful ? `-${formatFormulaNumber(stabilityDays)} × ln(${formatFormulaNumber(retentionTarget)})` : `${formatFormulaNumber(mastery)} < ${formatFormulaNumber(BKT_PARAMETERS.successThreshold)}`,
        calculation: successful
          ? `-${formatFormulaNumber(stabilityDays)} × ${formatFormulaNumber(Math.log(retentionTarget))} = ${formatFormulaNumber(nextReviewInDays!)} days`
          : `${formatFormulaNumber(mastery * 100)}% < ${formatFormulaNumber(BKT_PARAMETERS.successThreshold * 100)}% → Review Now`,
        explanation: successful
          ? 'Solves the exponential decay curve for the time when retained memory reaches the configured fraction of current mastery.'
          : 'Requests immediate review because the final mastery is below the configured success threshold.',
        symbols: successful
          ? [
              { symbol: 'Δt', meaning: 'Delay until the next review, measured in days.', value: nextReviewInDays!, unit: 'days' },
              { symbol: 'S', meaning: 'Current stability in days.', value: stabilityDays, unit: 'days' },
              { symbol: 'ln', meaning: 'The natural logarithm.' },
              { symbol: 'retentionTarget', meaning: 'Target retained fraction of current mastery.', value: retentionTarget, unit: 'probability' },
            ]
          : [
              { symbol: 'Mastery', meaning: 'Current mastery probability.', value: mastery, unit: 'probability' },
              { symbol: 'successThreshold', meaning: 'Minimum mastery required for a successful review.', value: BKT_PARAMETERS.successThreshold, unit: 'probability' },
            ],
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

export function restoreLiveQuestionCalculation(
  stored: Pick<QuestionModelUpdate, 'priorMastery' | 'isCorrect'> & {
    priorSource?: LiveQuestionCalculation['priorSource'];
  },
  fallbackPriorSource: LiveQuestionCalculation['priorSource'],
  successfulReviewsBefore: number,
  answeredAt: Date,
): LiveQuestionCalculation {
  return calculateLiveQuestion(
    stored.priorMastery,
    stored.isCorrect,
    stored.priorSource ?? fallbackPriorSource,
    successfulReviewsBefore,
    answeredAt,
  );
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
