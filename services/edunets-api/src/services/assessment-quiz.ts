import { randomUUID } from 'node:crypto';

import { and, asc, eq } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import {
  quizAttemptAnswers,
  quizAttemptQuestions,
  quizAttempts,
  userTopicModeProgress,
  userTopicProgress,
} from '../../../../database/schema/learning.js';
import { ApiError } from '../errors.js';
import {
  KNOWLEDGE_MODEL_VERSION,
  PHASE1_PARAMETERS,
  calculateConceptMemory,
  calculateEssayMastery,
  calculateMcqMastery,
  calculateReminder,
  elapsedDaysBetween,
  type AssessmentMode,
  type ModeCalculation,
} from '../lib/knowledge-model.js';
import { getKeyedQuestions } from '../lib/question-bank.js';
import { calculatePercentCorrect } from '../lib/scoring.js';
import { commitModeProgress, loadModeProgress, lockTopic, type ApiTransaction } from './phase1-progress.js';

export type AssessmentAnswerInput = {
  questionKey: string;
  questionIndex: number;
  answer: string | number;
  marksObtained?: number | undefined;
};

const attemptSelection = {
  id: quizAttempts.id,
  submissionId: quizAttempts.submissionId,
  userId: quizAttempts.userId,
  subjectId: quizAttempts.subjectId,
  topicId: quizAttempts.topicId,
  mode: quizAttempts.quizMode,
  status: quizAttempts.status,
  initialMastery: quizAttempts.initialMastery,
  priorMastery: quizAttempts.priorMastery,
  priorElapsedDays: quizAttempts.priorElapsedDays,
  posteriorMastery: quizAttempts.posteriorMastery,
  currentMastery: quizAttempts.currentMastery,
  correctAnswers: quizAttempts.correctAnswers,
  totalQuestions: quizAttempts.totalQuestions,
  percentCorrect: quizAttempts.percentCorrect,
  marksObtained: quizAttempts.marksObtained,
  maximumMarks: quizAttempts.maximumMarks,
  feedbackStatus: quizAttempts.feedbackStatus,
  calculationTrace: quizAttempts.calculationTrace,
  startedAt: quizAttempts.startedAt,
  submittedAt: quizAttempts.submittedAt,
  completedAt: quizAttempts.completedAt,
  feedbackCompletedAt: quizAttempts.feedbackCompletedAt,
};

type SelectedAttempt = typeof quizAttempts.$inferSelect & { mode?: AssessmentMode };

function asAssessmentMode(mode: string): AssessmentMode {
  if (mode !== 'mcq' && mode !== 'essay') throw new Error(`Unsupported assessment mode: ${mode}`);
  return mode;
}

async function loadLockedAssessmentAttempt(
  transaction: ApiTransaction,
  userId: string,
  submissionId: string,
) {
  const [candidate] = await transaction.select({
    userId: quizAttempts.userId,
    topicId: quizAttempts.topicId,
  }).from(quizAttempts).where(eq(quizAttempts.submissionId, submissionId)).limit(1);
  if (!candidate || candidate.userId !== userId) {
    throw new ApiError(404, 'ASSESSMENT_NOT_FOUND', 'This assessment session was not found.');
  }

  await lockTopic(transaction, userId, candidate.topicId);
  const [attempt] = await transaction.select(attemptSelection)
    .from(quizAttempts)
    .where(and(eq(quizAttempts.submissionId, submissionId), eq(quizAttempts.userId, userId)))
    .limit(1);
  if (!attempt || (attempt.mode !== 'mcq' && attempt.mode !== 'essay')) {
    throw new ApiError(404, 'ASSESSMENT_NOT_FOUND', 'This assessment session was not found.');
  }
  return { ...attempt, mode: asAssessmentMode(attempt.mode) };
}

function buildCalculation(
  attempt: Pick<SelectedAttempt, 'quizMode' | 'initialMastery' | 'priorElapsedDays' | 'feedbackStatus'>,
  answers: Array<{ isCorrect: boolean | null; marksObtained: number | null; maximumMarks: number | null }>,
): ModeCalculation | null {
  if (answers.length === 0) return null;
  const mode = asAssessmentMode(attempt.quizMode);
  const common = {
    previousMastery: attempt.initialMastery ?? PHASE1_PARAMETERS.initialMastery,
    elapsedDays: attempt.priorElapsedDays ?? 0,
    feedbackCompleted: attempt.feedbackStatus === 'completed',
  };
  if (mode === 'mcq') {
    const correct = answers.filter((answer) => answer.isCorrect).length;
    return calculateMcqMastery({ ...common, correct, wrong: answers.length - correct });
  }
  return calculateEssayMastery({
    ...common,
    marksObtained: answers.reduce((sum, answer) => sum + (answer.marksObtained ?? 0), 0),
    maximumMarks: answers.reduce((sum, answer) => sum + (answer.maximumMarks ?? 0), 0),
  });
}

async function loadPublishedConcept(userId: string, topicId: string) {
  const calculatedAt = new Date();
  const [modeRows, conceptRows] = await Promise.all([
    db.select({
      mode: userTopicModeProgress.assessmentMode,
      mastery: userTopicModeProgress.mastery,
      lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
      quizAttempts: userTopicModeProgress.quizAttempts,
    }).from(userTopicModeProgress).where(and(
      eq(userTopicModeProgress.userId, userId),
      eq(userTopicModeProgress.topicId, topicId),
    )),
    db.select({
      nextReviewAt: userTopicProgress.nextReviewAt,
      reminderCalculatedAt: userTopicProgress.reminderCalculatedAt,
    })
      .from(userTopicProgress)
      .where(and(eq(userTopicProgress.userId, userId), eq(userTopicProgress.topicId, topicId)))
      .limit(1),
  ]);
  const summary = calculateConceptMemory(modeRows, calculatedAt);
  const nextReviewAt = conceptRows[0]?.nextReviewAt ?? null;
  const reminderCalculatedAt = conceptRows[0]?.reminderCalculatedAt ?? null;
  const settledConcept = reminderCalculatedAt
    ? calculateConceptMemory(modeRows, reminderCalculatedAt).conceptMemory
    : null;
  const reminder = settledConcept === null || reminderCalculatedAt === null
    ? null
    : { ...calculateReminder(settledConcept, reminderCalculatedAt), conceptMemory: settledConcept };
  return {
    ...summary,
    nextReviewAt,
    reminderCalculatedAt,
    reminder,
    reviewNow: summary.conceptMemory !== null
      && (summary.conceptMemory <= PHASE1_PARAMETERS.memoryThreshold
        || (nextReviewAt !== null && nextReviewAt <= calculatedAt)),
  };
}

async function loadAssessmentSession(userId: string, submissionId: string, resumed: boolean) {
  const [attempt] = await db.select(attemptSelection)
    .from(quizAttempts)
    .where(and(eq(quizAttempts.submissionId, submissionId), eq(quizAttempts.userId, userId)))
    .limit(1);
  if (!attempt || (attempt.mode !== 'mcq' && attempt.mode !== 'essay')) {
    throw new ApiError(404, 'ASSESSMENT_NOT_FOUND', 'This assessment session was not found.');
  }

  const [questionRows, answerRows] = await Promise.all([
    db.select({
      questionIndex: quizAttemptQuestions.questionIndex,
      questionKey: quizAttemptQuestions.questionKey,
      type: quizAttemptQuestions.type,
      topic: quizAttemptQuestions.topic,
      text: quizAttemptQuestions.text,
      options: quizAttemptQuestions.options,
      correctAnswer: quizAttemptQuestions.correctAnswer,
      explanation: quizAttemptQuestions.explanation,
      linkedConcept: quizAttemptQuestions.linkedConcept,
      source: quizAttemptQuestions.source,
      resourceNumber: quizAttemptQuestions.resourceNumber,
      maxMarks: quizAttemptQuestions.maxMarks,
    }).from(quizAttemptQuestions)
      .where(eq(quizAttemptQuestions.attemptId, attempt.id))
      .orderBy(asc(quizAttemptQuestions.questionIndex)),
    db.select({
      questionKey: quizAttemptAnswers.questionKey,
      questionIndex: quizAttemptAnswers.questionIndex,
      submittedAnswer: quizAttemptAnswers.submittedAnswer,
      isCorrect: quizAttemptAnswers.isCorrect,
      marksObtained: quizAttemptAnswers.marksObtained,
      maximumMarks: quizAttemptAnswers.maximumMarks,
      answeredAt: quizAttemptAnswers.answeredAt,
    }).from(quizAttemptAnswers)
      .where(eq(quizAttemptAnswers.attemptId, attempt.id))
      .orderBy(asc(quizAttemptAnswers.questionIndex)),
  ]);
  const questionByKey = new Map(questionRows.map((question) => [question.questionKey, question]));
  const answers = answerRows.map((answer) => {
    const question = questionByKey.get(answer.questionKey);
    if (!question) throw new Error(`Question snapshot ${answer.questionKey} is missing.`);
    return {
      ...answer,
      submittedAnswer: attempt.mode === 'mcq' ? Number(answer.submittedAnswer) : answer.submittedAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
    };
  });
  const calculation = buildCalculation(
    {
      quizMode: attempt.mode,
      initialMastery: attempt.initialMastery,
      priorElapsedDays: attempt.priorElapsedDays,
      feedbackStatus: attempt.feedbackStatus,
    },
    answers,
  );
  const concept = await loadPublishedConcept(userId, attempt.topicId);

  return {
    submissionId: attempt.submissionId,
    subjectId: attempt.subjectId,
    topicId: attempt.topicId,
    mode: attempt.mode,
    status: attempt.status,
    feedbackStatus: attempt.feedbackStatus,
    resumed,
    questions: questionRows.map((question) => ({
      questionKey: question.questionKey,
      type: question.type,
      topic: question.topic,
      text: question.text,
      ...(question.options ? { options: question.options } : {}),
      ...(question.source ? { source: question.source } : {}),
      ...(question.resourceNumber ? { resourceNumber: question.resourceNumber } : {}),
      ...(question.maxMarks !== null ? { maxMarks: question.maxMarks } : {}),
    })),
    model: {
      version: KNOWLEDGE_MODEL_VERSION,
      parameters: PHASE1_PARAMETERS,
      previousMastery: attempt.initialMastery ?? PHASE1_PARAMETERS.initialMastery,
      priorMastery: attempt.priorMastery ?? PHASE1_PARAMETERS.initialMastery,
      priorElapsedDays: attempt.priorElapsedDays ?? 0,
      calculation,
    },
    session: {
      answered: answers.length,
      total: attempt.totalQuestions,
      correct: answers.filter((answer) => answer.isCorrect).length,
      marksObtained: answers.reduce((sum, answer) => sum + (answer.marksObtained ?? 0), 0),
      maximumMarks: answers.reduce((sum, answer) => sum + (answer.maximumMarks ?? 0), 0),
    },
    answers,
    concept,
  };
}

export async function createOrResumeAssessmentSession(
  userId: string,
  input: { submissionId: string; topicId: string; mode: AssessmentMode },
) {
  const result = await db.transaction(async (transaction) => {
    await lockTopic(transaction, userId, input.topicId);
    const [active] = await transaction.select({ submissionId: quizAttempts.submissionId })
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.topicId, input.topicId),
        eq(quizAttempts.status, 'in_progress'),
      )).limit(1);
    if (active) return { submissionId: active.submissionId, resumed: true };

    const [usedSubmission] = await transaction.select({ id: quizAttempts.id })
      .from(quizAttempts).where(eq(quizAttempts.submissionId, input.submissionId)).limit(1);
    if (usedSubmission) throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');

    const questionSet = await getKeyedQuestions(input.topicId, input.mode, input.submissionId);
    const expectedCount = input.mode === 'mcq' ? 10 : 5;
    if (!questionSet || questionSet.questions.length !== expectedCount) {
      throw new ApiError(409, 'QUESTION_SET_UNAVAILABLE', `This topic does not have a complete ${input.mode.toUpperCase()} set.`);
    }

    const now = new Date();
    await transaction.update(quizAttempts).set({
      feedbackStatus: 'skipped',
      feedbackSkippedAt: now,
    }).where(and(
      eq(quizAttempts.userId, userId),
      eq(quizAttempts.topicId, input.topicId),
      eq(quizAttempts.feedbackStatus, 'pending'),
      eq(quizAttempts.status, 'completed'),
    ));

    const progress = await loadModeProgress(transaction, userId, input.topicId, input.mode);
    const previousMastery = progress?.mastery ?? PHASE1_PARAMETERS.initialMastery;
    const elapsedDays = progress ? elapsedDaysBetween(progress.lastUpdatedAt, now) : 0;
    const priorMastery = previousMastery * Math.exp(-elapsedDays / PHASE1_PARAMETERS.stabilityDays);
    const attemptId = randomUUID();
    await transaction.insert(quizAttempts).values({
      id: attemptId,
      submissionId: input.submissionId,
      userId,
      subjectId: questionSet.subjectId,
      topicId: questionSet.topicId,
      quizMode: input.mode,
      questionSetVersion: `phase1-${input.mode}-v1`,
      correctAnswers: 0,
      totalQuestions: expectedCount,
      percentCorrect: 0,
      resultingMemoryScore: null,
      status: 'in_progress',
      modelVersion: KNOWLEDGE_MODEL_VERSION,
      initialMastery: previousMastery,
      priorMastery,
      priorElapsedDays: elapsedDays,
      currentMastery: priorMastery,
      feedbackStatus: 'pending',
      startedAt: now,
      submittedAt: now,
    });
    await transaction.insert(quizAttemptQuestions).values(questionSet.questions.map((question, questionIndex) => ({
      attemptId,
      questionIndex,
      questionKey: question.questionKey,
      type: question.type,
      topic: question.topic,
      text: question.text,
      options: question.options ?? null,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
      source: question.source ?? null,
      resourceNumber: question.resourceNumber ?? null,
      maxMarks: question.maxMarks ?? null,
    })));
    return { submissionId: input.submissionId, resumed: false };
  });
  return loadAssessmentSession(userId, result.submissionId, result.resumed);
}

export async function submitAssessmentAnswer(userId: string, submissionId: string, input: AssessmentAnswerInput) {
  const result = await db.transaction(async (transaction) => {
    const attempt = await loadLockedAssessmentAttempt(transaction, userId, submissionId);
    if (attempt.status !== 'in_progress') throw new ApiError(409, 'ASSESSMENT_COMPLETED', 'This assessment is already complete.');

    const existingRows = await transaction.select({
      questionKey: quizAttemptAnswers.questionKey,
      questionIndex: quizAttemptAnswers.questionIndex,
      submittedAnswer: quizAttemptAnswers.submittedAnswer,
      marksObtained: quizAttemptAnswers.marksObtained,
    }).from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, attempt.id));
    const existing = existingRows.find((answer) => answer.questionKey === input.questionKey);
    if (existing) {
      if (existing.questionIndex === input.questionIndex
        && String(existing.submittedAnswer) === String(input.answer)
        && (attempt.mode === 'mcq' || existing.marksObtained === input.marksObtained)) {
        return { idempotentReplay: true };
      }
      throw new ApiError(409, 'ANSWER_ALREADY_SUBMITTED', 'A different answer has already been saved for this question.');
    }
    if (input.questionIndex !== existingRows.length) {
      throw new ApiError(409, 'ANSWER_OUT_OF_ORDER', `Submit question ${existingRows.length + 1} next.`);
    }

    const [question] = await transaction.select({
      questionKey: quizAttemptQuestions.questionKey,
      type: quizAttemptQuestions.type,
      correctAnswer: quizAttemptQuestions.correctAnswer,
      maxMarks: quizAttemptQuestions.maxMarks,
    }).from(quizAttemptQuestions).where(and(
      eq(quizAttemptQuestions.attemptId, attempt.id),
      eq(quizAttemptQuestions.questionIndex, input.questionIndex),
    )).limit(1);
    if (!question || question.questionKey !== input.questionKey) {
      throw new ApiError(409, 'QUESTION_MISMATCH', 'This question is not next in the saved set.');
    }

    let isCorrect: boolean | null = null;
    let marksObtained: number | null = null;
    let maximumMarks: number | null = null;
    if (attempt.mode === 'mcq') {
      if (question.type !== 'mcq' || typeof input.answer !== 'number') {
        throw new ApiError(400, 'INVALID_MCQ_ANSWER', 'MCQ answers must be option numbers.');
      }
      isCorrect = input.answer === question.correctAnswer;
    } else {
      if (question.type !== 'structured' || typeof input.answer !== 'string' || !input.answer.trim()) {
        throw new ApiError(400, 'INVALID_ESSAY_ANSWER', 'Essay answers must contain written text.');
      }
      maximumMarks = question.maxMarks ?? 10;
      if (input.marksObtained === undefined || !Number.isFinite(input.marksObtained)
        || input.marksObtained < 0 || input.marksObtained > maximumMarks
        || Math.abs(input.marksObtained * 100 - Math.round(input.marksObtained * 100)) > 1e-8) {
        throw new ApiError(400, 'INVALID_ESSAY_MARKS', `Essay marks must be between 0 and ${maximumMarks} with at most two decimal places.`);
      }
      marksObtained = input.marksObtained;
    }

    const now = new Date();
    await transaction.insert(quizAttemptAnswers).values({
      attemptId: attempt.id,
      questionKey: input.questionKey,
      questionIndex: input.questionIndex,
      submittedAnswer: input.answer,
      isCorrect,
      marksObtained,
      maximumMarks,
      answeredAt: now,
    });
    const answerCount = existingRows.length + 1;
    const correctAnswers = attempt.correctAnswers + (isCorrect ? 1 : 0);
    const totalMarks = (attempt.marksObtained ?? 0) + (marksObtained ?? 0);
    const totalMaximumMarks = (attempt.maximumMarks ?? 0) + (maximumMarks ?? 0);
    await transaction.update(quizAttempts).set({
      correctAnswers,
      percentCorrect: attempt.mode === 'mcq'
        ? calculatePercentCorrect(correctAnswers, answerCount)
        : totalMaximumMarks === 0 ? 0 : (totalMarks / totalMaximumMarks) * 100,
      marksObtained: attempt.mode === 'essay' ? totalMarks : null,
      maximumMarks: attempt.mode === 'essay' ? totalMaximumMarks : null,
      submittedAt: now,
    }).where(eq(quizAttempts.id, attempt.id));
    return { idempotentReplay: false };
  });

  const session = await loadAssessmentSession(userId, submissionId, true);
  const answer = session.answers.find((stored) => stored.questionKey === input.questionKey);
  if (!answer) throw new Error(`Stored answer ${input.questionKey} could not be reconstructed.`);
  return { ...session, answer, idempotentReplay: result.idempotentReplay };
}

export async function finishAssessmentSession(userId: string, submissionId: string) {
  const result = await db.transaction(async (transaction) => {
    const attempt = await loadLockedAssessmentAttempt(transaction, userId, submissionId);
    if (attempt.status === 'completed') return { idempotentReplay: true };
    if (attempt.status !== 'in_progress') throw new ApiError(409, 'ASSESSMENT_ABANDONED', 'This assessment was abandoned.');

    const answers = await transaction.select({
      isCorrect: quizAttemptAnswers.isCorrect,
      marksObtained: quizAttemptAnswers.marksObtained,
      maximumMarks: quizAttemptAnswers.maximumMarks,
    }).from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, attempt.id));
    if (answers.length !== attempt.totalQuestions) {
      throw new ApiError(409, 'ASSESSMENT_INCOMPLETE', `Answer all ${attempt.totalQuestions} questions before finishing.`);
    }
    const calculation = buildCalculation(
      { quizMode: attempt.mode, initialMastery: attempt.initialMastery, priorElapsedDays: attempt.priorElapsedDays, feedbackStatus: 'pending' },
      answers,
    );
    if (!calculation) throw new Error('Completed assessment has no calculation.');
    const completedAt = new Date();
    const published = await commitModeProgress({
      transaction,
      userId,
      topicId: attempt.topicId,
      mode: attempt.mode,
      mastery: calculation.posteriorMastery,
      updatedAt: completedAt,
      incrementAttempt: true,
    });
    await transaction.update(quizAttempts).set({
      status: 'completed',
      posteriorMastery: calculation.posteriorMastery,
      currentMastery: calculation.posteriorMastery,
      calculationTrace: calculation,
      resultingMemoryScore: published.concept.conceptMemoryScore,
      completedAt,
      submittedAt: completedAt,
    }).where(eq(quizAttempts.id, attempt.id));
    return { idempotentReplay: false };
  });
  return { ...(await loadAssessmentSession(userId, submissionId, true)), idempotentReplay: result.idempotentReplay };
}

export async function completeAssessmentFeedback(userId: string, submissionId: string) {
  const result = await db.transaction(async (transaction) => {
    const attempt = await loadLockedAssessmentAttempt(transaction, userId, submissionId);
    if (attempt.status !== 'completed') throw new ApiError(409, 'ASSESSMENT_INCOMPLETE', 'Finish the assessment before completing corrections.');
    if (attempt.feedbackStatus === 'completed') return { idempotentReplay: true };
    if (attempt.feedbackStatus === 'skipped') {
      throw new ApiError(409, 'FEEDBACK_SKIPPED', 'This correction opportunity was closed when a newer assessment started.');
    }

    const answers = await transaction.select({
      isCorrect: quizAttemptAnswers.isCorrect,
      marksObtained: quizAttemptAnswers.marksObtained,
      maximumMarks: quizAttemptAnswers.maximumMarks,
    }).from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, attempt.id));
    const calculation = buildCalculation(
      { quizMode: attempt.mode, initialMastery: attempt.initialMastery, priorElapsedDays: attempt.priorElapsedDays, feedbackStatus: 'completed' },
      answers,
    );
    if (!calculation) throw new Error('Completed assessment has no calculation.');
    const completedAt = new Date();
    const published = await commitModeProgress({
      transaction,
      userId,
      topicId: attempt.topicId,
      mode: attempt.mode,
      mastery: calculation.currentMastery,
      updatedAt: completedAt,
      incrementAttempt: false,
    });
    await transaction.update(quizAttempts).set({
      feedbackStatus: 'completed',
      feedbackCompletedAt: completedAt,
      currentMastery: calculation.currentMastery,
      calculationTrace: calculation,
      resultingMemoryScore: published.concept.conceptMemoryScore,
    }).where(eq(quizAttempts.id, attempt.id));
    return { idempotentReplay: false };
  });
  return { ...(await loadAssessmentSession(userId, submissionId, true)), idempotentReplay: result.idempotentReplay };
}

export async function abandonAssessmentSession(userId: string, submissionId: string) {
  await db.transaction(async (transaction) => {
    const attempt = await loadLockedAssessmentAttempt(transaction, userId, submissionId);
    if (attempt.status === 'completed') throw new ApiError(409, 'ASSESSMENT_COMPLETED', 'A completed assessment cannot be abandoned.');
    if (attempt.status === 'in_progress') {
      const now = new Date();
      await transaction.update(quizAttempts).set({ status: 'abandoned', abandonedAt: now, submittedAt: now })
        .where(eq(quizAttempts.id, attempt.id));
    }
  });
  return { ok: true as const };
}
