import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { ACTIVE_SUBJECT_IDS } from '../../../../database/constants.js';
import { db } from '../../../../database/index.js';
import {
  schools,
  subjects,
  topics,
} from '../../../../database/schema/catalog.js';
import { CURRICULUM } from '../../../../lib/curriculum.js';
import {
  onboardingProfiles,
  profiles,
  quizAttemptAnswers,
  quizAttemptQuestions,
  quizAttempts,
  teachingScopes,
} from '../../../../database/schema/learning.js';
import { ApiError, readJson } from '../errors.js';
import { analyzeExplanation } from '../services/explanation-analysis.js';
import { getAnalysisModel, isAnalysisConfigured } from '../services/modelarts.js';
import { evaluateNotes } from '../services/note-evaluation.js';
import { getOcrProvider, isOcrConfigured } from '../services/ocr.js';
import { summarizeNotes } from '../services/summarize-notes.js';
import {
  captureEvaluateSchema,
  captureOcrSchema,
  captureSummarizeSchema,
  discussionAnalysisSchema,
} from '../validation.js';
import {
  KNOWLEDGE_MODEL_VERSION,
  PHASE1_PARAMETERS,
  calculateMcqMastery,
} from '../lib/knowledge-model.js';
import {
  getPlacementQuestions,
  getQuizOptions,
  gradeQuestion,
  serializePlacementQuestions,
  type QuizQuestion,
} from '../lib/question-bank.js';
import {
  calculatePercentCorrect,
} from '../lib/scoring.js';
import { loadSession, requireSession } from '../middleware/session.js';
import { getStudyStateForUser } from '../services/study-state.js';
import {
  abandonAssessmentSession,
  completeAssessmentFeedback,
  createOrResumeAssessmentSession,
  finishAssessmentSession,
  submitAssessmentAnswer,
} from '../services/assessment-quiz.js';
import { commitModeProgress, lockTopic } from '../services/phase1-progress.js';
import { getQuizReviewForTeacher, saveQuestionReview } from '../services/quiz-review.js';
import { localizeQuestions, parseLocale } from '../lib/question-translations.js';
import {
  addStudentToScope,
  getClassConceptWebForTeacher,
  getStudentConceptWebForTeacher,
  listStudentsForTeacher,
  removeStudentFromScope,
  searchStudentsForTeacher,
} from '../services/teacher-students.js';
import type { AppEnv } from '../types.js';
import {
  addStudentToScopeSchema,
  onboardingRequestSchema,
  placementSetRequestSchema,
  quizOptionsQuerySchema,
  quizHistoryQuerySchema,
  quizSetRequestSchema,
  assessmentAnswerSchema,
  studentSearchQuerySchema,
  updateQuestionReviewSchema,
  updateSchoolSchema,
  updateTeachingScopesSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();
const activeSubjectIds: string[] = [...ACTIVE_SUBJECT_IDS];

function activeSubjectName(subject: { id: string; name: string }) {
  return subject.id === 'e-math' ? 'Mathematics' : subject.name;
}

function requireUserId(context: Context<AppEnv>): string {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user.id;
}

/**
 * Localizes the `questions` array on an assessment-session response, if it has
 * one. Four routes return this shape (create, answer, finish, feedback-complete)
 * and an idempotent replay or an abandon response carries no `questions` at
 * all, so the check is structural rather than per-route.
 *
 * Applied at the route rather than inside assessment-quiz.ts, so that service
 * keeps returning one canonical (English) shape and translation stays a
 * presentation concern at the edge — the same boundary the placement-set route
 * uses.
 */
function localizeSessionQuestions<T extends { questions?: unknown }>(result: T, context: Context<AppEnv>): T {
  if (!Array.isArray(result.questions)) return result;
  return {
    ...result,
    questions: localizeQuestions(
      result.questions as { questionKey: string; text: string; options?: string[] }[],
      parseLocale(context.req.header('accept-language')),
    ),
  };
}

async function loadTeachingScopes(userId: string) {
  const rows = await db.select({
    id: teachingScopes.id,
    schoolId: teachingScopes.schoolId,
    schoolName: schools.name,
    subjectId: teachingScopes.subjectId,
    subjectName: subjects.name,
    subjectIcon: subjects.icon,
    classroomName: teachingScopes.classroomName,
    position: teachingScopes.position,
  })
    .from(teachingScopes)
    .innerJoin(schools, eq(schools.id, teachingScopes.schoolId))
    .innerJoin(subjects, eq(subjects.id, teachingScopes.subjectId))
    .where(and(
      eq(teachingScopes.userId, userId),
      inArray(teachingScopes.subjectId, activeSubjectIds),
    ))
    .orderBy(asc(teachingScopes.position), asc(teachingScopes.id));

  return rows.map((scope) => ({
    ...scope,
    subjectName: activeSubjectName({ id: scope.subjectId, name: scope.subjectName }),
  }));
}

api.get('/catalog', async (context) => {
  const schoolRows = await db.select({ id: schools.id, name: schools.name })
    .from(schools)
    .orderBy(asc(schools.position));

  return context.json({
    schools: schoolRows,
    // The two-subject curriculum is versioned with the application. Returning
    // it from that source of truth keeps authentication/onboarding available
    // while an existing deployment is between the additive schema migration
    // and the catalog seed. Schools remain database-backed reference data.
    subjects: CURRICULUM.map((subject) => ({
      ...subject,
      topics: subject.topics.map((topic) => ({
        ...topic,
        subtopics: topic.subtopics.map((child) => ({ ...child, topicId: topic.id })),
      })),
    })),
  });
});

api.get('/me', loadSession, requireSession, async (context) => {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  const scopeRowsPromise = loadTeachingScopes(user.id);

  const [profile] = await db.select({
    role: profiles.role,
    schoolId: profiles.schoolId,
    schoolName: schools.name,
    onboardingCompleted: profiles.onboardingCompleted,
    learningSource: onboardingProfiles.learningSource,
    materialName: onboardingProfiles.materialName,
    materialType: onboardingProfiles.materialType,
    materialSize: onboardingProfiles.materialSize,
    materialLastModified: onboardingProfiles.materialLastModified,
    recordingDurationSeconds: onboardingProfiles.recordingDurationSeconds,
    recordingMimeType: onboardingProfiles.recordingMimeType,
    subjectId: onboardingProfiles.subjectId,
    subjectName: subjects.name,
    topicId: onboardingProfiles.topicId,
    topicName: topics.name,
    initialMastery: onboardingProfiles.initialMastery,
    placementAttemptId: onboardingProfiles.placementAttemptId,
    completedAt: onboardingProfiles.completedAt,
  })
    .from(profiles)
    .leftJoin(schools, eq(profiles.schoolId, schools.id))
    .leftJoin(onboardingProfiles, eq(profiles.userId, onboardingProfiles.userId))
    .leftJoin(subjects, eq(onboardingProfiles.subjectId, subjects.id))
    .leftJoin(topics, eq(onboardingProfiles.topicId, topics.id))
    .where(eq(profiles.userId, user.id))
    .limit(1);
  const scopeRows = await scopeRowsPromise;

  return context.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image ?? null,
    },
    onboardingCompleted: profile?.onboardingCompleted ?? false,
    profile: profile ? {
      role: profile.role,
      schoolId: profile.schoolId,
      schoolName: profile.schoolName,
      learningSource: profile.learningSource,
      material: profile.materialName !== null
        && profile.materialType !== null
        && profile.materialSize !== null
        && profile.materialLastModified !== null
        ? {
            name: profile.materialName,
            type: profile.materialType,
            size: profile.materialSize,
            lastModified: profile.materialLastModified,
          }
        : null,
      recording: profile.recordingDurationSeconds !== null
        && profile.recordingMimeType !== null
        ? {
            durationSeconds: profile.recordingDurationSeconds,
            mimeType: profile.recordingMimeType,
          }
        : null,
      subjectId: profile.subjectId,
      subjectName: profile.subjectName,
      topicId: profile.topicId,
      topicName: profile.topicName,
      initialMastery: profile.initialMastery,
      placementAttemptId: profile.placementAttemptId,
      completedAt: profile.completedAt,
      teachingScopes: scopeRows,
    } : null,
  });
});

api.put('/me/teaching-scopes', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = updateTeachingScopesSchema.parse(await readJson(context));
  const [profile] = await db.select({ role: profiles.role, schoolId: profiles.schoolId })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile || profile.role !== 'teacher') {
    throw new ApiError(403, 'TEACHER_ONLY', 'Only teachers can update teaching contexts.');
  }

  const requestedSubjectIds = [...new Set(input.scopes.map((scope) => scope.subjectId))];
  const subjectRows = await db.select({ id: subjects.id })
    .from(subjects)
    .where(inArray(subjects.id, requestedSubjectIds));
  if (subjectRows.length !== requestedSubjectIds.length) {
    throw new ApiError(400, 'INVALID_TEACHING_SUBJECT', 'One or more teaching subjects were not found.');
  }

  const firstScope = input.scopes[0]!;

  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.delete(teachingScopes).where(eq(teachingScopes.userId, userId));
    await transaction.insert(teachingScopes).values(input.scopes.map((scope, position) => ({
      id: randomUUID(),
      userId,
      schoolId: profile.schoolId,
      subjectId: scope.subjectId,
      classroomName: scope.classroomName,
      position,
      createdAt: now,
      updatedAt: now,
    })));
    await transaction.update(onboardingProfiles).set({
      subjectId: firstScope.subjectId,
      topicId: null,
      updatedAt: now,
    }).where(eq(onboardingProfiles.userId, userId));
  });

  return context.json({ scopes: await loadTeachingScopes(userId) });
});

api.put('/me/school', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = updateSchoolSchema.parse(await readJson(context));

  const [profile] = await db.select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (!profile || profile.role !== 'student') {
    throw new ApiError(403, 'STUDENT_ONLY', 'Only students can update their school here.');
  }

  const [school] = await db.select({ id: schools.id, name: schools.name })
    .from(schools)
    .where(eq(schools.id, input.schoolId))
    .limit(1);
  if (!school) throw new ApiError(400, 'INVALID_SCHOOL', 'Selected school was not found.');

  await db.update(profiles).set({ schoolId: school.id, updatedAt: new Date() }).where(eq(profiles.userId, userId));

  return context.json({ schoolId: school.id, schoolName: school.name });
});

type PlacementAttemptSummary = {
  id: string;
  submissionId: string;
  topicId: string;
  correctAnswers: number;
  totalQuestions: number;
  percentCorrect: number;
  currentMastery: number | null;
  calculationTrace: Record<string, unknown> | null;
  submittedAt: Date;
};

type StoredPlacementAnswer = {
  questionKey: string;
  questionIndex: number;
  submittedAnswer: string | number;
  isCorrect: boolean | null;
};

function buildPlacementResult(
  attempt: PlacementAttemptSummary,
  storedAnswers: StoredPlacementAnswer[],
  questions: QuizQuestion[],
) {
  const questionByKey = new Map(questions.map((question) => [question.questionKey, question]));
  const mastery = attempt.currentMastery ?? PHASE1_PARAMETERS.initialMastery;
  return {
    id: attempt.id,
    submissionId: attempt.submissionId,
    topicId: attempt.topicId,
    correctAnswers: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions,
    percentCorrect: attempt.percentCorrect,
    resultingMastery: mastery,
    masteryScore: mastery * 100,
    submittedAt: attempt.submittedAt,
    model: attempt.calculationTrace,
    answers: storedAnswers.map((answer) => {
      const question = questionByKey.get(answer.questionKey);
      if (!question) throw new Error(`Placement question ${answer.questionKey} could not be reconstructed.`);
      return {
        questionKey: answer.questionKey,
        questionIndex: answer.questionIndex,
        submittedAnswer: Number(answer.submittedAnswer),
        isCorrect: Boolean(answer.isCorrect),
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      };
    }),
  };
}

api.post('/me/onboarding/placement-set', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = placementSetRequestSchema.parse(await readJson(context));
  const [profile] = await db.select({ onboardingCompleted: profiles.onboardingCompleted })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  if (profile?.onboardingCompleted) {
    throw new ApiError(409, 'ONBOARDING_ALREADY_COMPLETED', 'Your starting profile is already complete.');
  }

  const questionSet = await getPlacementQuestions(input.topicId, input.subjectId, input.submissionId);
  if (!questionSet) {
    throw new ApiError(409, 'PLACEMENT_SET_UNAVAILABLE', 'The database has no complete 10-question placement set for this topic.');
  }

  return context.json({
    submissionId: input.submissionId,
    subjectId: questionSet.subjectId,
    topicId: questionSet.topicId,
    questions: localizeQuestions(
      serializePlacementQuestions(questionSet.questions),
      parseLocale(context.req.header('accept-language')),
    ),
  });
});

api.put('/me/onboarding', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = onboardingRequestSchema.parse(await readJson(context));
  const placementSet = input.role === 'student'
    ? await getPlacementQuestions(input.topicId, input.subjectId, input.placement.submissionId)
    : null;
  if (input.role === 'student' && !placementSet) {
    throw new ApiError(409, 'PLACEMENT_SET_UNAVAILABLE', 'The database has no complete 10-question placement set for this topic.');
  }

  const submittedByKey = input.role === 'student'
    ? new Map(input.placement.answers.map((answer) => [answer.questionKey, answer.answer]))
    : new Map<string, number>();
  if (input.role === 'student' && placementSet && (
    submittedByKey.size !== input.placement.answers.length
    || placementSet.questions.some((question) => !submittedByKey.has(question.questionKey))
  )) {
    throw new ApiError(400, 'INVALID_ANSWER_SET', 'Submit exactly one answer for every placement question.');
  }

  const result = await db.transaction(async (transaction) => {
    const [existing] = await transaction.select({
      role: profiles.role,
      schoolId: profiles.schoolId,
      schoolName: schools.name,
      onboardingCompleted: profiles.onboardingCompleted,
      onboardingCompletedAt: profiles.onboardingCompletedAt,
      learningSource: onboardingProfiles.learningSource,
      subjectId: onboardingProfiles.subjectId,
      subjectName: subjects.name,
      topicId: onboardingProfiles.topicId,
      topicName: topics.name,
      initialMastery: onboardingProfiles.initialMastery,
      placementAttemptId: onboardingProfiles.placementAttemptId,
      completedAt: onboardingProfiles.completedAt,
    })
      .from(profiles)
      .leftJoin(schools, eq(profiles.schoolId, schools.id))
      .leftJoin(onboardingProfiles, eq(profiles.userId, onboardingProfiles.userId))
      .leftJoin(subjects, eq(onboardingProfiles.subjectId, subjects.id))
      .leftJoin(topics, eq(onboardingProfiles.topicId, topics.id))
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (existing?.onboardingCompleted) {
      let placementResult = null;
      if (input.role === 'student' && placementSet && existing.placementAttemptId) {
        const [attempt] = await transaction.select({
          id: quizAttempts.id,
          submissionId: quizAttempts.submissionId,
          topicId: quizAttempts.topicId,
          correctAnswers: quizAttempts.correctAnswers,
          totalQuestions: quizAttempts.totalQuestions,
          percentCorrect: quizAttempts.percentCorrect,
          currentMastery: quizAttempts.currentMastery,
          calculationTrace: quizAttempts.calculationTrace,
          submittedAt: quizAttempts.submittedAt,
        }).from(quizAttempts).where(and(
          eq(quizAttempts.id, existing.placementAttemptId),
          eq(quizAttempts.submissionId, input.placement.submissionId),
          eq(quizAttempts.userId, userId),
        )).limit(1);
        if (attempt) {
          const storedAnswers = await transaction.select({
            questionKey: quizAttemptAnswers.questionKey,
            questionIndex: quizAttemptAnswers.questionIndex,
            submittedAnswer: quizAttemptAnswers.submittedAnswer,
            isCorrect: quizAttemptAnswers.isCorrect,
          }).from(quizAttemptAnswers)
            .where(eq(quizAttemptAnswers.attemptId, attempt.id))
            .orderBy(asc(quizAttemptAnswers.questionIndex));
          placementResult = buildPlacementResult(attempt, storedAnswers, placementSet.questions);
        }
      }
      return {
        alreadyCompleted: true,
        onboardingCompleted: true,
        profile: existing,
        placementResult,
      };
    }

    const [school] = input.schoolId
      ? await transaction.select({ id: schools.id, name: schools.name })
        .from(schools).where(eq(schools.id, input.schoolId)).limit(1)
      : await transaction.select({ id: schools.id, name: schools.name })
        .from(schools).where(eq(schools.name, input.school!)).limit(1);
    if (!school) throw new ApiError(400, 'INVALID_SCHOOL', 'Select a school from the catalog.');

    const now = new Date();
    if (input.role === 'teacher') {
      const requestedSubjectIds = [...new Set(input.teachingScopes.map((scope) => scope.subjectId))];
      const validSubjects = await transaction.select({ id: subjects.id, name: subjects.name })
        .from(subjects).where(inArray(subjects.id, requestedSubjectIds));
      if (validSubjects.length !== requestedSubjectIds.length) {
        throw new ApiError(400, 'INVALID_TEACHING_SUBJECT', 'One or more teaching subjects were not found.');
      }
      const primaryScope = input.teachingScopes[0]!;
      const primarySubject = validSubjects.find((subject) => subject.id === primaryScope.subjectId)!;

      await transaction.insert(profiles).values({
        userId, role: 'teacher', schoolId: school.id, onboardingCompleted: true,
        onboardingCompletedAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: profiles.userId,
        set: { role: 'teacher', schoolId: school.id, onboardingCompleted: true, onboardingCompletedAt: now, updatedAt: now },
      });
      await transaction.insert(onboardingProfiles).values({
        userId, learningSource: 'none', subjectId: primarySubject.id, topicId: null,
        initialMastery: null, placementAttemptId: null, completedAt: now, updatedAt: now,
      }).onConflictDoUpdate({
        target: onboardingProfiles.userId,
        set: { subjectId: primarySubject.id, topicId: null, initialMastery: null, placementAttemptId: null, completedAt: now, updatedAt: now },
      });
      await transaction.delete(teachingScopes).where(eq(teachingScopes.userId, userId));
      await transaction.insert(teachingScopes).values(input.teachingScopes.map((scope, position) => ({
        id: randomUUID(), userId, schoolId: school.id, subjectId: scope.subjectId,
        classroomName: scope.classroomName, position, createdAt: now, updatedAt: now,
      })));

      return {
        alreadyCompleted: false,
        onboardingCompleted: true,
        profile: {
          role: 'teacher' as const,
          schoolId: school.id,
          schoolName: school.name,
          learningSource: 'none' as const,
          subjectId: primarySubject.id,
          subjectName: primarySubject.name,
          topicId: null,
          topicName: null,
          initialMastery: null,
          placementAttemptId: null,
          completedAt: now,
          teachingScopes: input.teachingScopes,
        },
        placementResult: null,
      };
    }

    const studentPlacementSet = placementSet!;
    const [selectedTopic] = await transaction.select({
      id: topics.id,
      name: topics.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    }).from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(and(eq(topics.id, input.topicId), eq(topics.subjectId, input.subjectId)))
      .limit(1);
    if (!selectedTopic) throw new ApiError(400, 'INVALID_TOPIC', 'The topic does not belong to the selected subject.');

    const gradedAnswers = studentPlacementSet.questions.map((question, questionIndex) => {
      const submittedAnswer = submittedByKey.get(question.questionKey)!;
      return {
        questionKey: question.questionKey,
        questionIndex,
        submittedAnswer,
        isCorrect: gradeQuestion(question, submittedAnswer),
      };
    });
    const correctAnswers = gradedAnswers.filter((answer) => answer.isCorrect).length;
    const percentCorrect = calculatePercentCorrect(correctAnswers, gradedAnswers.length);
    const model = calculateMcqMastery({
      correct: correctAnswers,
      wrong: gradedAnswers.length - correctAnswers,
      feedbackCompleted: true,
    });
    const resultingMastery = model.currentMastery;
    await lockTopic(transaction, userId, selectedTopic.id);

    const [attempt] = await transaction.insert(quizAttempts).values({
      id: randomUUID(),
      submissionId: input.placement.submissionId,
      userId,
      subjectId: selectedTopic.subjectId,
      topicId: selectedTopic.id,
      quizMode: 'placement',
      questionSetVersion: 'placement-phase1-v2',
      correctAnswers,
      totalQuestions: gradedAnswers.length,
      percentCorrect,
      resultingMemoryScore: null,
      status: 'completed',
      modelVersion: KNOWLEDGE_MODEL_VERSION,
      initialMastery: PHASE1_PARAMETERS.initialMastery,
      priorMastery: model.priorMastery,
      priorElapsedDays: 0,
      posteriorMastery: model.posteriorMastery,
      currentMastery: resultingMastery,
      feedbackStatus: 'completed',
      feedbackCompletedAt: now,
      calculationTrace: model,
      startedAt: input.placement.startedAt ? new Date(input.placement.startedAt) : null,
      submittedAt: now,
      completedAt: now,
    }).onConflictDoNothing({ target: quizAttempts.submissionId }).returning({
      id: quizAttempts.id,
      submissionId: quizAttempts.submissionId,
      topicId: quizAttempts.topicId,
      correctAnswers: quizAttempts.correctAnswers,
      totalQuestions: quizAttempts.totalQuestions,
      percentCorrect: quizAttempts.percentCorrect,
      currentMastery: quizAttempts.currentMastery,
      calculationTrace: quizAttempts.calculationTrace,
      submittedAt: quizAttempts.submittedAt,
    });
    if (!attempt) throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');

    await transaction.insert(quizAttemptQuestions).values(studentPlacementSet.questions.map((question, questionIndex) => ({
      attemptId: attempt.id,
      questionIndex,
      questionKey: question.questionKey,
      type: question.type,
      topic: question.topic,
      subtopicId: question.subtopic?.id ?? null,
      subtopicSyllabusCode: question.subtopic?.syllabusCode ?? null,
      subtopicName: question.subtopic?.name ?? null,
      text: question.text,
      options: question.options ?? null,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      linkedConcept: question.linkedConcept,
      source: question.source ?? null,
      resourceNumber: question.resourceNumber ?? null,
      maxMarks: null,
    })));

    await transaction.insert(profiles).values({
      userId, role: 'student', schoolId: school.id, onboardingCompleted: true,
      onboardingCompletedAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: profiles.userId,
      set: { role: 'student', schoolId: school.id, onboardingCompleted: true, onboardingCompletedAt: now, updatedAt: now },
    });
    await transaction.insert(quizAttemptAnswers).values(gradedAnswers.map((answer) => ({
      attemptId: attempt.id,
      ...answer,
      answeredAt: now,
    })));
    await transaction.insert(onboardingProfiles).values({
      userId, learningSource: 'none', subjectId: selectedTopic.subjectId, topicId: selectedTopic.id,
      initialMastery: resultingMastery, placementAttemptId: attempt.id, completedAt: now, updatedAt: now,
    }).onConflictDoUpdate({
      target: onboardingProfiles.userId,
      set: {
        subjectId: selectedTopic.subjectId, topicId: selectedTopic.id, initialMastery: resultingMastery,
        placementAttemptId: attempt.id, completedAt: now, updatedAt: now,
      },
    });
    const published = await commitModeProgress({
      transaction,
      userId,
      topicId: selectedTopic.id,
      mode: 'mcq',
      mastery: resultingMastery,
      updatedAt: now,
      incrementAttempt: true,
    });
    await transaction.update(quizAttempts).set({
      resultingMemoryScore: published.concept.conceptMemoryScore,
    }).where(eq(quizAttempts.id, attempt.id));

    return {
      alreadyCompleted: false,
      onboardingCompleted: true,
      profile: {
        role: 'student' as const,
        schoolId: school.id,
        schoolName: school.name,
        learningSource: 'none' as const,
        subjectId: selectedTopic.subjectId,
        subjectName: selectedTopic.subjectName,
        topicId: selectedTopic.id,
        topicName: selectedTopic.name,
        initialMastery: resultingMastery,
        placementAttemptId: attempt.id,
        completedAt: now,
        teachingScopes: [],
      },
      placementResult: buildPlacementResult(attempt, gradedAnswers, studentPlacementSet.questions),
    };
  });

  return context.json(result);
});

api.get('/me/study-state', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const state = await getStudyStateForUser(userId);
  return context.json(state);
});

api.get('/me/students', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const students = await listStudentsForTeacher(userId, context.req.query('scopeId'));
  return context.json({ students });
});

// Registered before the /me/students/:studentId/concept-web param route
// below so "search" is never captured as a literal studentId.
api.get('/me/students/search', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = studentSearchQuerySchema.parse({
    q: context.req.query('q'),
    scopeId: context.req.query('scopeId'),
  });
  const students = await searchStudentsForTeacher(userId, input.q, input.scopeId);
  return context.json({ students });
});

api.post('/me/students', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = addStudentToScopeSchema.parse(await readJson(context));
  await addStudentToScope(userId, input.studentId, input.scopeId);
  return context.json({ ok: true });
});

api.delete('/me/students/:studentId', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const studentId = context.req.param('studentId');
  const scopeId = context.req.query('scopeId');
  if (!scopeId) throw new ApiError(400, 'SCOPE_ID_REQUIRED', 'scopeId is required.');
  await removeStudentFromScope(userId, studentId, scopeId);
  return context.json({ ok: true });
});

api.get('/me/class-concept-web', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const result = await getClassConceptWebForTeacher(userId, context.req.query('scopeId'));
  return context.json(result);
});

api.get('/me/students/:studentId/concept-web', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const studentId = context.req.param('studentId');
  const result = await getStudentConceptWebForTeacher(userId, studentId, context.req.query('scopeId'));
  return context.json(result);
});

api.get('/me/quiz-review', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const result = await getQuizReviewForTeacher(userId, context.req.query('scopeId'));
  return context.json(result);
});

api.put('/me/quiz-review', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = updateQuestionReviewSchema.parse(await readJson(context));
  await saveQuestionReview(userId, input.questionKey, input.explanation);
  return context.json({ ok: true });
});

api.get('/me/quiz-options', loadSession, requireSession, async (context) => {
  const input = quizOptionsQuerySchema.parse(context.req.query());
  const options = await getQuizOptions(input.topicId, input.subjectId);
  if (!options) {
    throw new ApiError(400, 'INVALID_QUIZ_SELECTION', 'The topic does not belong to the selected subject.');
  }
  return context.json(options);
});

api.post('/me/quiz-sets', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = quizSetRequestSchema.parse(await readJson(context));
  const result = await createOrResumeAssessmentSession(userId, input);
  return context.json(localizeSessionQuestions(result, context), result.resumed ? 200 : 201);
});

api.post('/me/quiz-attempts/:submissionId/answers', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = assessmentAnswerSchema.parse(await readJson(context));
  const result = await submitAssessmentAnswer(userId, context.req.param('submissionId'), input);
  return context.json(localizeSessionQuestions(result, context), result.idempotentReplay ? 200 : 201);
});

api.post('/me/quiz-attempts/:submissionId/finish', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const result = await finishAssessmentSession(userId, context.req.param('submissionId'));
  return context.json(localizeSessionQuestions(result, context));
});

api.post('/me/quiz-attempts/:submissionId/feedback-complete', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const result = await completeAssessmentFeedback(userId, context.req.param('submissionId'));
  return context.json(localizeSessionQuestions(result, context));
});

api.post('/me/quiz-attempts/:submissionId/abandon', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  return context.json(await abandonAssessmentSession(userId, context.req.param('submissionId')));
});

api.get('/me/quiz-attempts', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const query = quizHistoryQuerySchema.parse(context.req.query());
  const filters = query.topicId
    ? and(eq(quizAttempts.userId, userId), eq(quizAttempts.topicId, query.topicId))
    : eq(quizAttempts.userId, userId);

  const attemptRows = await db.select({
    id: quizAttempts.id,
    submissionId: quizAttempts.submissionId,
    subjectId: quizAttempts.subjectId,
    topicId: quizAttempts.topicId,
    mode: quizAttempts.quizMode,
    questionSetVersion: quizAttempts.questionSetVersion,
    correctAnswers: quizAttempts.correctAnswers,
    totalQuestions: quizAttempts.totalQuestions,
    percentCorrect: quizAttempts.percentCorrect,
    resultingMemoryScore: quizAttempts.resultingMemoryScore,
    status: quizAttempts.status,
    feedbackStatus: quizAttempts.feedbackStatus,
    priorMastery: quizAttempts.priorMastery,
    posteriorMastery: quizAttempts.posteriorMastery,
    currentMastery: quizAttempts.currentMastery,
    marksObtained: quizAttempts.marksObtained,
    maximumMarks: quizAttempts.maximumMarks,
    calculationTrace: quizAttempts.calculationTrace,
    startedAt: quizAttempts.startedAt,
    submittedAt: quizAttempts.submittedAt,
  })
    .from(quizAttempts)
    .where(filters)
    .orderBy(desc(quizAttempts.submittedAt), desc(quizAttempts.id))
    .limit(query.limit);

  const answerRows = attemptRows.length === 0 ? [] : await db.select({
    attemptId: quizAttemptAnswers.attemptId,
    questionKey: quizAttemptAnswers.questionKey,
    questionIndex: quizAttemptAnswers.questionIndex,
    submittedAnswer: quizAttemptAnswers.submittedAnswer,
    isCorrect: quizAttemptAnswers.isCorrect,
    marksObtained: quizAttemptAnswers.marksObtained,
    maximumMarks: quizAttemptAnswers.maximumMarks,
  })
    .from(quizAttemptAnswers)
    .where(inArray(quizAttemptAnswers.attemptId, attemptRows.map((attempt) => attempt.id)))
    .orderBy(asc(quizAttemptAnswers.attemptId), asc(quizAttemptAnswers.questionIndex));

  const answersByAttempt = new Map<string, typeof answerRows>();
  for (const answer of answerRows) {
    const list = answersByAttempt.get(answer.attemptId) ?? [];
    list.push(answer);
    answersByAttempt.set(answer.attemptId, list);
  }

  return context.json({
    attempts: attemptRows.map((attempt) => ({
      ...attempt,
      answers: (answersByAttempt.get(attempt.id) ?? []).map((answer) => ({
        questionKey: answer.questionKey,
        questionIndex: answer.questionIndex,
        submittedAnswer: answer.submittedAnswer,
        isCorrect: answer.isCorrect,
        marksObtained: answer.marksObtained,
        maximumMarks: answer.maximumMarks,
      })),
    })),
  });
});

// Marks a spoken explanation against the syllabus content this project already
// holds. Separate from the client-side rubric on purpose: the rubric answers
// "was it mentioned", deterministically and offline; this answers "was it
// right", and needs a model.
//
// Never fails the request. If analysis is unconfigured, times out, or comes
// back unparseable, the response says so and the room keeps showing rubric
// coverage. Losing the marking should never cost a student the session.
api.post('/me/discussion-analysis', loadSession, requireSession, async (context) => {
  requireUserId(context);
  const input = discussionAnalysisSchema.parse(await readJson(context));

  if (!isAnalysisConfigured()) {
    return context.json({ available: false, analysis: null });
  }

  const model = getAnalysisModel();
  if (!model) return context.json({ available: false, analysis: null });

  try {
    const analysis = await analyzeExplanation(input.topicId, input.transcript, model);
    return context.json({ available: true, analysis });
  } catch {
    // The upstream error can echo the prompt, which carries the transcript, so
    // it is not logged or returned.
    return context.json({ available: true, analysis: null });
  }
});

// Capture Hub: OCR a photographed or scanned page of notes.
//
// `available: false` means this deployment has no OCR provider configured;
// `available: true, text: null` means a provider was called and it failed.
// The frontend tells those apart -- one says "not set up here", the other
// says "try again" -- and either way the student's typed/pasted text still
// works, since OCR only ever adds to that rather than replacing it.
api.post('/me/capture/ocr', loadSession, requireSession, async (context) => {
  requireUserId(context);
  const input = captureOcrSchema.parse(await readJson(context));

  if (!isOcrConfigured()) {
    return context.json({ available: false, text: null });
  }
  const provider = getOcrProvider();
  if (!provider) return context.json({ available: false, text: null });

  try {
    const text = await provider.recognize(Buffer.from(input.imageBase64, 'base64'), input.mimeType);
    return context.json({ available: true, text });
  } catch {
    // The upstream error can carry account details; not logged or returned.
    return context.json({ available: true, text: null });
  }
});

// Capture Hub: compress OCR'd and/or typed notes into key points. Not graded
// against the syllabus -- see /me/capture/evaluate for that -- a summary
// reflects what the student wrote, nothing more.
api.post('/me/capture/summarize', loadSession, requireSession, async (context) => {
  requireUserId(context);
  const input = captureSummarizeSchema.parse(await readJson(context));

  if (!isAnalysisConfigured()) {
    return context.json({ available: false, points: null });
  }
  const model = getAnalysisModel();
  if (!model) return context.json({ available: false, points: null });

  try {
    const points = await summarizeNotes(input.text, model);
    return context.json({ available: true, points });
  } catch {
    return context.json({ available: true, points: null });
  }
});

// Capture Hub: mark captured notes against the syllabus content behind
// discussion-analysis, reporting a derived percentage alongside what the notes
// got right, wrong, and never mentioned.
api.post('/me/capture/evaluate', loadSession, requireSession, async (context) => {
  requireUserId(context);
  const input = captureEvaluateSchema.parse(await readJson(context));

  if (!isAnalysisConfigured()) {
    return context.json({ available: false, evaluation: null });
  }
  const model = getAnalysisModel();
  if (!model) return context.json({ available: false, evaluation: null });

  try {
    const evaluation = await evaluateNotes(input.topicId, input.text, model);
    return context.json({ available: true, evaluation });
  } catch {
    return context.json({ available: true, evaluation: null });
  }
});

export { api as apiV1 };
