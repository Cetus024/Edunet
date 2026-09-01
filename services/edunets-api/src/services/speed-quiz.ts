import { randomUUID } from 'node:crypto';

import { and, asc, eq, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import {
  quizAttemptAnswers,
  quizAttemptQuestions,
  quizAttempts,
  userTopicProgress,
} from '../../../../database/schema/learning.js';
import { ApiError } from '../errors.js';
import {
  BKT_PARAMETERS,
  KNOWLEDGE_MODEL_VERSION,
  calculateLiveQuestion,
  calculateQuestionUpdate,
  calculateReviewSummary,
  restoreLiveQuestionCalculation,
  type LiveQuestionCalculation,
} from '../lib/knowledge-model.js';
import { getKeyedQuestions } from '../lib/question-bank.js';
import { calculatePercentCorrect } from '../lib/scoring.js';

type SpeedAnswerInput = {
  questionKey: string;
  questionIndex: number;
  answer: number;
};

type StoredTrace = LiveQuestionCalculation;

const attemptSelection = {
  id: quizAttempts.id,
  submissionId: quizAttempts.submissionId,
  userId: quizAttempts.userId,
  subjectId: quizAttempts.subjectId,
  topicId: quizAttempts.topicId,
  status: quizAttempts.status,
  initialMastery: quizAttempts.initialMastery,
  currentMastery: quizAttempts.currentMastery,
  stabilityBefore: quizAttempts.stabilityBefore,
  stabilityAfter: quizAttempts.stabilityAfter,
  successfulReviewsBefore: quizAttempts.successfulReviewsBefore,
  successfulReviewsAfter: quizAttempts.successfulReviewsAfter,
  correctAnswers: quizAttempts.correctAnswers,
  totalQuestions: quizAttempts.totalQuestions,
  percentCorrect: quizAttempts.percentCorrect,
  startedAt: quizAttempts.startedAt,
  submittedAt: quizAttempts.submittedAt,
  completedAt: quizAttempts.completedAt,
};

async function lockSpeedAttempt(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  submissionId: string,
) {
  await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`speed:${submissionId}`}))`);
}

function publicQuestion(question: {
  questionKey: string;
  type: string;
  topic: string;
  text: string;
  options: string[] | null;
  source: string | null;
  resourceNumber: string | null;
}) {
  return {
    questionKey: question.questionKey,
    type: 'mcq' as const,
    topic: question.topic,
    text: question.text,
    options: question.options ?? [],
    ...(question.source ? { source: question.source } : {}),
    ...(question.resourceNumber ? { resourceNumber: question.resourceNumber } : {}),
  };
}

async function loadSpeedSession(userId: string, submissionId: string, resumed: boolean) {
  const [attempt] = await db.select(attemptSelection)
    .from(quizAttempts)
    .where(and(eq(quizAttempts.submissionId, submissionId), eq(quizAttempts.userId, userId)))
    .limit(1);
  if (!attempt) throw new ApiError(404, 'SPEED_SESSION_NOT_FOUND', 'This Speed session was not found.');

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
    }).from(quizAttemptQuestions)
      .where(eq(quizAttemptQuestions.attemptId, attempt.id))
      .orderBy(asc(quizAttemptQuestions.questionIndex)),
    db.select({
      questionKey: quizAttemptAnswers.questionKey,
      questionIndex: quizAttemptAnswers.questionIndex,
      submittedAnswer: quizAttemptAnswers.submittedAnswer,
      isCorrect: quizAttemptAnswers.isCorrect,
      priorMastery: quizAttemptAnswers.priorMastery,
      posteriorMastery: quizAttemptAnswers.posteriorMastery,
      masteryAfterTransition: quizAttemptAnswers.masteryAfterTransition,
      predictedCorrectness: quizAttemptAnswers.predictedCorrectness,
      calculationTrace: quizAttemptAnswers.calculationTrace,
      answeredAt: quizAttemptAnswers.answeredAt,
    }).from(quizAttemptAnswers)
      .where(eq(quizAttemptAnswers.attemptId, attempt.id))
      .orderBy(asc(quizAttemptAnswers.questionIndex)),
  ]);
  const questionByKey = new Map(questionRows.map((question) => [question.questionKey, question]));
  const initialMastery = attempt.initialMastery ?? BKT_PARAMETERS.initialMastery;
  const successfulReviewsBefore = attempt.successfulReviewsBefore ?? 0;
  const answers = answerRows.map((answer) => {
    const question = questionByKey.get(answer.questionKey);
    if (!question) throw new Error(`Speed question ${answer.questionKey} snapshot is missing.`);
    const storedTrace = answer.calculationTrace as Partial<StoredTrace> | null;
    const priorMastery = answer.priorMastery ?? storedTrace?.priorMastery ?? initialMastery;
    const answeredAt = answer.answeredAt ?? attempt.submittedAt ?? attempt.startedAt ?? new Date(0);
    const fallbackPriorSource: LiveQuestionCalculation['priorSource'] = answer.questionIndex > 0
      ? 'previous_question'
      : priorMastery === BKT_PARAMETERS.initialMastery
        ? 'initial_model'
        : 'stored_mastery';
    const model = restoreLiveQuestionCalculation(
      {
        priorMastery,
        isCorrect: answer.isCorrect,
        ...(storedTrace?.priorSource ? { priorSource: storedTrace.priorSource } : {}),
      },
      fallbackPriorSource,
      successfulReviewsBefore,
      answeredAt,
    );
    return {
      questionKey: answer.questionKey,
      questionIndex: answer.questionIndex,
      submittedAnswer: Number(answer.submittedAnswer),
      isCorrect: answer.isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
      answeredAt,
      model,
    };
  });
  const initialProjection = calculateReviewSummary(
    initialMastery,
    successfulReviewsBefore,
    attempt.startedAt ?? attempt.submittedAt,
  );
  const currentProjection = answers.at(-1)?.model.projection ?? initialProjection;

  return {
    submissionId: attempt.submissionId,
    subjectId: attempt.subjectId,
    topicId: attempt.topicId,
    mode: 'speed-round' as const,
    status: attempt.status,
    resumed,
    questions: questionRows.map(publicQuestion),
    model: {
      version: KNOWLEDGE_MODEL_VERSION,
      parameters: BKT_PARAMETERS,
      initialMastery,
      currentMastery: attempt.currentMastery ?? initialMastery,
      predictedCorrectness: answers.at(-1)?.model.predictedCorrectness ?? null,
      stabilityBefore: attempt.stabilityBefore ?? BKT_PARAMETERS.initialStabilityDays,
      successfulReviewsBefore,
      currentProjection,
      startingBranches: {
        correct: calculateQuestionUpdate(initialMastery, true),
        wrong: calculateQuestionUpdate(initialMastery, false),
      },
    },
    session: {
      answered: answers.length,
      total: attempt.totalQuestions,
      correct: answers.filter((answer) => answer.isCorrect).length,
      rawAccuracy: answers.length === 0 ? 0 : answers.filter((answer) => answer.isCorrect).length / answers.length,
      timeline: [
        { label: 'Start', questionIndex: -1, isCorrect: null, mastery: initialMastery },
        ...answers.map((answer) => ({
          label: `Q${answer.questionIndex + 1}`,
          questionIndex: answer.questionIndex,
          isCorrect: answer.isCorrect,
          mastery: answer.model.currentMastery,
        })),
      ],
    },
    answers,
  };
}

export async function createOrResumeSpeedSession(
  userId: string,
  input: { submissionId: string; topicId: string },
) {
  const [alreadyActive] = await db.select({ submissionId: quizAttempts.submissionId })
    .from(quizAttempts)
    .where(and(
      eq(quizAttempts.userId, userId),
      eq(quizAttempts.topicId, input.topicId),
      eq(quizAttempts.quizMode, 'speed-round'),
      eq(quizAttempts.status, 'in_progress'),
    )).limit(1);
  if (alreadyActive) return loadSpeedSession(userId, alreadyActive.submissionId, true);

  const questionSet = await getKeyedQuestions(input.topicId, 'speed-round', input.submissionId);
  if (!questionSet || questionSet.questions.length !== 10) {
    throw new ApiError(409, 'QUESTION_SET_UNAVAILABLE', 'This topic does not have a complete 10-question Speed set.');
  }

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`speed-topic:${userId}:${input.topicId}`}))`);
    const [racedActive] = await transaction.select({ submissionId: quizAttempts.submissionId })
      .from(quizAttempts)
      .where(and(
        eq(quizAttempts.userId, userId),
        eq(quizAttempts.topicId, input.topicId),
        eq(quizAttempts.quizMode, 'speed-round'),
        eq(quizAttempts.status, 'in_progress'),
      )).limit(1);
    if (racedActive) return { submissionId: racedActive.submissionId, resumed: true };

    const [usedSubmission] = await transaction.select({ userId: quizAttempts.userId })
      .from(quizAttempts).where(eq(quizAttempts.submissionId, input.submissionId)).limit(1);
    if (usedSubmission) throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');

    const [progress] = await transaction.select({
      mastery: userTopicProgress.mastery,
      stabilityDays: userTopicProgress.stabilityDays,
      successfulReviews: userTopicProgress.successfulReviews,
    }).from(userTopicProgress).where(and(
      eq(userTopicProgress.userId, userId),
      eq(userTopicProgress.topicId, input.topicId),
    )).limit(1);
    const initialMastery = progress?.mastery ?? BKT_PARAMETERS.initialMastery;
    const now = new Date();
    const attemptId = randomUUID();
    await transaction.insert(quizAttempts).values({
      id: attemptId,
      submissionId: input.submissionId,
      userId,
      subjectId: questionSet.subjectId,
      topicId: questionSet.topicId,
      quizMode: 'speed-round',
      questionSetVersion: 'speed-bkt-v1',
      correctAnswers: 0,
      totalQuestions: 10,
      percentCorrect: 0,
      resultingMemoryScore: null,
      status: 'in_progress',
      modelVersion: KNOWLEDGE_MODEL_VERSION,
      initialMastery,
      currentMastery: initialMastery,
      stabilityBefore: progress?.stabilityDays ?? BKT_PARAMETERS.initialStabilityDays,
      stabilityAfter: null,
      successfulReviewsBefore: progress?.successfulReviews ?? 0,
      successfulReviewsAfter: null,
      startedAt: now,
      submittedAt: now,
      completedAt: null,
      abandonedAt: null,
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
    })));
    return { submissionId: input.submissionId, resumed: false };
  });

  return loadSpeedSession(userId, result.submissionId, result.resumed);
}

export async function submitSpeedAnswer(userId: string, submissionId: string, input: SpeedAnswerInput) {
  const result = await db.transaction(async (transaction) => {
    await lockSpeedAttempt(transaction, submissionId);
    const [attempt] = await transaction.select(attemptSelection).from(quizAttempts)
      .where(eq(quizAttempts.submissionId, submissionId)).limit(1);
    if (!attempt || attempt.userId !== userId || attempt.status === 'abandoned') {
      throw new ApiError(404, 'SPEED_SESSION_NOT_FOUND', 'This active Speed session was not found.');
    }
    if (attempt.status !== 'in_progress') {
      throw new ApiError(409, 'SPEED_SESSION_COMPLETED', 'This Speed session has already been completed.');
    }

    const [existing] = await transaction.select({
      questionIndex: quizAttemptAnswers.questionIndex,
      submittedAnswer: quizAttemptAnswers.submittedAnswer,
    }).from(quizAttemptAnswers).where(and(
      eq(quizAttemptAnswers.attemptId, attempt.id),
      eq(quizAttemptAnswers.questionKey, input.questionKey),
    )).limit(1);
    if (existing) {
      if (existing.questionIndex === input.questionIndex && Number(existing.submittedAnswer) === input.answer) {
        return { idempotentReplay: true };
      }
      throw new ApiError(409, 'ANSWER_ALREADY_SUBMITTED', 'A different answer has already been saved for this question.');
    }

    const answered = await transaction.select({ questionIndex: quizAttemptAnswers.questionIndex })
      .from(quizAttemptAnswers).where(eq(quizAttemptAnswers.attemptId, attempt.id));
    if (input.questionIndex !== answered.length) {
      throw new ApiError(409, 'ANSWER_OUT_OF_ORDER', `Submit question ${answered.length + 1} next.`);
    }
    const [question] = await transaction.select({
      questionKey: quizAttemptQuestions.questionKey,
      correctAnswer: quizAttemptQuestions.correctAnswer,
    }).from(quizAttemptQuestions).where(and(
      eq(quizAttemptQuestions.attemptId, attempt.id),
      eq(quizAttemptQuestions.questionIndex, input.questionIndex),
    )).limit(1);
    if (!question || question.questionKey !== input.questionKey) {
      throw new ApiError(409, 'QUESTION_MISMATCH', 'This question is not next in the saved Speed set.');
    }

    const now = new Date();
    const isCorrect = input.answer === question.correctAnswer;
    const priorMastery = attempt.currentMastery ?? attempt.initialMastery ?? BKT_PARAMETERS.initialMastery;
    const priorSource = answered.length > 0
      ? 'previous_question' as const
      : priorMastery === BKT_PARAMETERS.initialMastery
        ? 'initial_model' as const
        : 'stored_mastery' as const;
    const update = calculateLiveQuestion(
      priorMastery,
      isCorrect,
      priorSource,
      attempt.successfulReviewsBefore ?? 0,
      now,
    );
    await transaction.insert(quizAttemptAnswers).values({
      attemptId: attempt.id,
      questionKey: input.questionKey,
      questionIndex: input.questionIndex,
      submittedAnswer: input.answer,
      isCorrect,
      priorMastery: update.priorMastery,
      posteriorMastery: update.posteriorMastery,
      masteryAfterTransition: update.currentMastery,
      predictedCorrectness: update.predictedCorrectness,
      calculationTrace: update,
      answeredAt: now,
    });
    const correctAnswers = attempt.correctAnswers + (isCorrect ? 1 : 0);
    const answerCount = answered.length + 1;
    await transaction.update(quizAttempts).set({
      currentMastery: update.currentMastery,
      correctAnswers,
      percentCorrect: calculatePercentCorrect(correctAnswers, answerCount),
      submittedAt: now,
    }).where(eq(quizAttempts.id, attempt.id));
    await transaction.insert(userTopicProgress).values({
      userId,
      topicId: attempt.topicId,
      mastery: update.currentMastery,
      stabilityDays: attempt.stabilityBefore ?? BKT_PARAMETERS.initialStabilityDays,
      successfulReviews: attempt.successfulReviewsBefore ?? 0,
      modelVersion: KNOWLEDGE_MODEL_VERSION,
      lastReviewedAt: now,
      quizAttempts: 0,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [userTopicProgress.userId, userTopicProgress.topicId],
      set: {
        mastery: update.currentMastery,
        modelVersion: KNOWLEDGE_MODEL_VERSION,
        lastReviewedAt: now,
        updatedAt: now,
      },
    });
    return { idempotentReplay: false };
  });

  const session = await loadSpeedSession(userId, submissionId, true);
  const answer = session.answers.find((stored) => stored.questionKey === input.questionKey);
  if (!answer) throw new Error(`Stored Speed answer ${input.questionKey} could not be reconstructed.`);
  return { ...session, answer, idempotentReplay: result.idempotentReplay };
}

export async function finishSpeedSession(userId: string, submissionId: string) {
  const result = await db.transaction(async (transaction) => {
    await lockSpeedAttempt(transaction, submissionId);
    const [attempt] = await transaction.select(attemptSelection).from(quizAttempts)
      .where(eq(quizAttempts.submissionId, submissionId)).limit(1);
    if (!attempt || attempt.userId !== userId || attempt.status === 'abandoned') {
      throw new ApiError(404, 'SPEED_SESSION_NOT_FOUND', 'This Speed session was not found.');
    }
    if (attempt.status === 'completed') {
      return {
        idempotentReplay: true,
        reviewedAt: attempt.completedAt ?? attempt.submittedAt,
        mastery: attempt.currentMastery!,
        successfulReviewsBefore: attempt.successfulReviewsBefore ?? 0,
      };
    }
    const answers = await transaction.select({ answeredAt: quizAttemptAnswers.answeredAt })
      .from(quizAttemptAnswers)
      .where(eq(quizAttemptAnswers.attemptId, attempt.id))
      .orderBy(asc(quizAttemptAnswers.questionIndex));
    if (answers.length !== 10) {
      throw new ApiError(409, 'SPEED_SESSION_INCOMPLETE', 'Answer all 10 questions before finishing.');
    }
    const reviewedAt = answers.at(-1)?.answeredAt ?? new Date();
    const mastery = attempt.currentMastery ?? BKT_PARAMETERS.initialMastery;
    const summary = calculateReviewSummary(mastery, attempt.successfulReviewsBefore ?? 0, reviewedAt);
    await transaction.update(quizAttempts).set({
      status: 'completed',
      stabilityAfter: summary.stabilityDays,
      successfulReviewsAfter: summary.successfulReviewsAfter,
      completedAt: reviewedAt,
      submittedAt: reviewedAt,
    }).where(eq(quizAttempts.id, attempt.id));
    await transaction.update(userTopicProgress).set({
      mastery,
      stabilityDays: summary.stabilityDays,
      successfulReviews: summary.successfulReviewsAfter,
      modelVersion: KNOWLEDGE_MODEL_VERSION,
      lastReviewedAt: reviewedAt,
      quizAttempts: sql`${userTopicProgress.quizAttempts} + 1`,
      updatedAt: reviewedAt,
    }).where(and(
      eq(userTopicProgress.userId, userId),
      eq(userTopicProgress.topicId, attempt.topicId),
    ));
    return {
      idempotentReplay: false,
      reviewedAt,
      mastery,
      successfulReviewsBefore: attempt.successfulReviewsBefore ?? 0,
    };
  });

  const session = await loadSpeedSession(userId, submissionId, true);
  return {
    ...session,
    idempotentReplay: result.idempotentReplay,
    result: {
      correctAnswers: session.session.correct,
      totalQuestions: session.session.total,
      percentCorrect: Math.round(session.session.rawAccuracy * 100),
      ...calculateReviewSummary(result.mastery, result.successfulReviewsBefore, result.reviewedAt),
    },
  };
}

export async function abandonSpeedSession(userId: string, submissionId: string) {
  await db.transaction(async (transaction) => {
    await lockSpeedAttempt(transaction, submissionId);
    const [attempt] = await transaction.select({
      id: quizAttempts.id,
      userId: quizAttempts.userId,
      status: quizAttempts.status,
    }).from(quizAttempts).where(eq(quizAttempts.submissionId, submissionId)).limit(1);
    if (!attempt || attempt.userId !== userId) {
      throw new ApiError(404, 'SPEED_SESSION_NOT_FOUND', 'This Speed session was not found.');
    }
    if (attempt.status === 'completed') {
      throw new ApiError(409, 'SPEED_SESSION_COMPLETED', 'A completed Speed session cannot be abandoned.');
    }
    if (attempt.status === 'in_progress') {
      const now = new Date();
      await transaction.update(quizAttempts).set({ status: 'abandoned', abandonedAt: now, submittedAt: now })
        .where(eq(quizAttempts.id, attempt.id));
    }
  });
  return { ok: true };
}
