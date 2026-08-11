import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { db } from '../../../../database/index.js';
import {
  schools,
  subjects,
  topicAliases,
  topics,
} from '../../../../database/schema/catalog.js';
import {
  onboardingProfiles,
  profiles,
  quizAttemptAnswers,
  quizAttempts,
  teachingScopes,
  userTopicProgress,
} from '../../../../database/schema/learning.js';
import { ApiError, readJson } from '../errors.js';
import { getKeyedQuestions, gradeQuestion } from '../lib/question-bank.js';
import { buildQuizAttemptResponse } from '../lib/quiz-attempt-response.js';
import {
  calculateMemoryScore,
  calculateNextReviewAt,
  calculatePercentCorrect,
  familiarityScore,
} from '../lib/scoring.js';
import { loadSession, requireSession } from '../middleware/session.js';
import { getChildForParent } from '../services/parent-child.js';
import { getStudyStateForUser } from '../services/study-state.js';
import { getQuizReviewForTeacher, saveQuestionReview } from '../services/quiz-review.js';
import {
  getClassConceptWebForTeacher,
  getStudentConceptWebForTeacher,
  listStudentsForTeacher,
} from '../services/teacher-students.js';
import type { AppEnv } from '../types.js';
import {
  onboardingRequestSchema,
  quizHistoryQuerySchema,
  quizSubmissionSchema,
  updateQuestionReviewSchema,
  updateSchoolSchema,
  updateTeachingScopesSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();

function requireUserId(context: Context<AppEnv>): string {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user.id;
}

async function loadTeachingScopes(userId: string) {
  return db.select({
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
    .where(eq(teachingScopes.userId, userId))
    .orderBy(asc(teachingScopes.position), asc(teachingScopes.id));
}

api.get('/catalog', async (context) => {
  const [schoolRows, subjectRows, topicRows, aliasRows] = await Promise.all([
    db.select({ id: schools.id, name: schools.name })
      .from(schools)
      .orderBy(asc(schools.position)),
    db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
      .from(subjects)
      .orderBy(asc(subjects.position)),
    db.select({ id: topics.id, subjectId: topics.subjectId, name: topics.name })
      .from(topics)
      .orderBy(asc(topics.subjectId), asc(topics.position)),
    db.select({ topicId: topicAliases.topicId, alias: topicAliases.alias })
      .from(topicAliases)
      .orderBy(asc(topicAliases.topicId), asc(topicAliases.alias)),
  ]);

  const aliasesByTopic = new Map<string, string[]>();
  for (const alias of aliasRows) {
    const list = aliasesByTopic.get(alias.topicId) ?? [];
    list.push(alias.alias);
    aliasesByTopic.set(alias.topicId, list);
  }

  const topicsBySubject = new Map<string, Array<{
    id: string;
    subjectId: string;
    name: string;
    aliases: string[];
  }>>();
  for (const topic of topicRows) {
    const list = topicsBySubject.get(topic.subjectId) ?? [];
    list.push({ ...topic, aliases: aliasesByTopic.get(topic.id) ?? [] });
    topicsBySubject.set(topic.subjectId, list);
  }

  return context.json({
    schools: schoolRows,
    subjects: subjectRows.map((subject) => ({
      ...subject,
      topics: topicsBySubject.get(subject.id) ?? [],
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
    familiarity: onboardingProfiles.familiarity,
    initialMemoryScore: onboardingProfiles.initialMemoryScore,
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
      familiarity: profile.familiarity,
      initialMemoryScore: profile.initialMemoryScore,
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

  if (!profile || (profile.role !== 'teacher' && profile.role !== 'tutor')) {
    throw new ApiError(403, 'TEACHER_ONLY', 'Only teachers and tutors can update teaching contexts.');
  }

  const requestedSubjectIds = [...new Set(input.scopes.map((scope) => scope.subjectId))];
  const subjectRows = await db.select({ id: subjects.id })
    .from(subjects)
    .where(inArray(subjects.id, requestedSubjectIds));
  if (subjectRows.length !== requestedSubjectIds.length) {
    throw new ApiError(400, 'INVALID_TEACHING_SUBJECT', 'One or more teaching subjects were not found.');
  }

  const firstScope = input.scopes[0]!;
  const [firstTopic] = await db.select({ id: topics.id })
    .from(topics)
    .where(eq(topics.subjectId, firstScope.subjectId))
    .orderBy(asc(topics.position))
    .limit(1);
  if (!firstTopic) throw new ApiError(400, 'SUBJECT_HAS_NO_TOPICS', 'The primary subject has no topics.');

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
      topicId: firstTopic.id,
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

api.put('/me/onboarding', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = onboardingRequestSchema.parse(await readJson(context));

  const result = await db.transaction(async (transaction) => {
    const [existing] = await transaction.select({
      role: profiles.role,
      schoolId: profiles.schoolId,
      onboardingCompleted: profiles.onboardingCompleted,
      onboardingCompletedAt: profiles.onboardingCompletedAt,
      learningSource: onboardingProfiles.learningSource,
      subjectId: onboardingProfiles.subjectId,
      topicId: onboardingProfiles.topicId,
      familiarity: onboardingProfiles.familiarity,
      initialMemoryScore: onboardingProfiles.initialMemoryScore,
      completedAt: onboardingProfiles.completedAt,
    })
      .from(profiles)
      .leftJoin(onboardingProfiles, eq(profiles.userId, onboardingProfiles.userId))
      .where(eq(profiles.userId, userId))
      .limit(1);

    // PUT is idempotent after completion. This avoids resetting a later quiz
    // score when a browser retries an already-committed onboarding request.
    if (existing?.onboardingCompleted) {
      return {
        alreadyCompleted: true,
        onboardingCompleted: true,
        profile: existing,
      };
    }

    const [school] = input.schoolId
      ? await transaction.select({ id: schools.id, name: schools.name })
        .from(schools)
        .where(eq(schools.id, input.schoolId))
        .limit(1)
      : await transaction.select({ id: schools.id, name: schools.name })
        .from(schools)
        .where(eq(schools.name, input.school!))
        .limit(1);

    if (!school) throw new ApiError(400, 'INVALID_SCHOOL', 'Select a school from the catalog.');

    const [selectedTopic] = await transaction.select({
      id: topics.id,
      name: topics.name,
      subjectId: subjects.id,
      subjectName: subjects.name,
    })
      .from(topics)
      .innerJoin(subjects, eq(topics.subjectId, subjects.id))
      .where(and(eq(topics.id, input.topicId), eq(topics.subjectId, input.subjectId)))
      .limit(1);

    if (!selectedTopic) {
      throw new ApiError(400, 'INVALID_TOPIC', 'The topic does not belong to the selected subject.');
    }

    const requestedTeachingScopes = input.role === 'teacher' || input.role === 'tutor'
      ? input.teachingScopes ?? [{
        subjectId: selectedTopic.subjectId,
        classroomName: `${selectedTopic.subjectName} class`,
      }]
      : [];
    if (requestedTeachingScopes.length > 0) {
      const requestedSubjectIds = [...new Set(requestedTeachingScopes.map((scope) => scope.subjectId))];
      const validTeachingSubjects = await transaction.select({ id: subjects.id })
        .from(subjects)
        .where(inArray(subjects.id, requestedSubjectIds));
      if (validTeachingSubjects.length !== requestedSubjectIds.length) {
        throw new ApiError(400, 'INVALID_TEACHING_SUBJECT', 'One or more teaching subjects were not found.');
      }
    }

    const now = new Date();
    const initialMemoryScore = familiarityScore(input.familiarity);
    const nextReviewAt = calculateNextReviewAt(initialMemoryScore, now);

    await transaction.insert(profiles).values({
      userId,
      role: input.role,
      schoolId: school.id,
      onboardingCompleted: true,
      onboardingCompletedAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: profiles.userId,
      set: {
        role: input.role,
        schoolId: school.id,
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        updatedAt: now,
      },
    });

    await transaction.insert(onboardingProfiles).values({
      userId,
      learningSource: input.learningSource,
      materialName: input.material?.name ?? null,
      materialType: input.material?.type ?? null,
      materialSize: input.material?.size ?? null,
      materialLastModified: input.material?.lastModified ?? null,
      recordingDurationSeconds: input.recording?.durationSeconds ?? null,
      recordingMimeType: input.recording?.mimeType ?? null,
      subjectId: selectedTopic.subjectId,
      topicId: selectedTopic.id,
      familiarity: input.familiarity,
      initialMemoryScore,
      childName: input.child?.name ?? null,
      childEmail: input.child?.email ?? null,
      completedAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: onboardingProfiles.userId,
      set: {
        learningSource: input.learningSource,
        materialName: input.material?.name ?? null,
        materialType: input.material?.type ?? null,
        materialSize: input.material?.size ?? null,
        materialLastModified: input.material?.lastModified ?? null,
        recordingDurationSeconds: input.recording?.durationSeconds ?? null,
        recordingMimeType: input.recording?.mimeType ?? null,
        subjectId: selectedTopic.subjectId,
        topicId: selectedTopic.id,
        familiarity: input.familiarity,
        initialMemoryScore,
        childName: input.child?.name ?? null,
        childEmail: input.child?.email ?? null,
        completedAt: now,
        updatedAt: now,
      },
    });

    if (requestedTeachingScopes.length > 0) {
      await transaction.insert(teachingScopes).values(requestedTeachingScopes.map((scope, position) => ({
        id: randomUUID(),
        userId,
        schoolId: school.id,
        subjectId: scope.subjectId,
        classroomName: scope.classroomName,
        position,
        createdAt: now,
        updatedAt: now,
      })));
    }

    await transaction.insert(userTopicProgress).values({
      userId,
      topicId: selectedTopic.id,
      memoryScore: initialMemoryScore,
      lastReviewedAt: now,
      nextReviewAt,
      quizAttempts: 0,
      updatedAt: now,
    }).onConflictDoNothing({
      target: [userTopicProgress.userId, userTopicProgress.topicId],
    });

    return {
      alreadyCompleted: false,
      onboardingCompleted: true,
      profile: {
        role: input.role,
        schoolId: school.id,
        schoolName: school.name,
        learningSource: input.learningSource,
        subjectId: selectedTopic.subjectId,
        subjectName: selectedTopic.subjectName,
        topicId: selectedTopic.id,
        topicName: selectedTopic.name,
        familiarity: input.familiarity,
        initialMemoryScore,
        completedAt: now,
      },
    };
  });

  return context.json(result);
});

api.get('/me/study-state', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const state = await getStudyStateForUser(userId);
  return context.json(state);
});

api.get('/me/child', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const result = await getChildForParent(userId);
  return context.json(result);
});

api.get('/me/students', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const students = await listStudentsForTeacher(userId, context.req.query('scopeId'));
  return context.json({ students });
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

api.post('/me/quiz-attempts', loadSession, requireSession, async (context) => {
  const userId = requireUserId(context);
  const input = quizSubmissionSchema.parse(await readJson(context));

  const [selectedTopic] = await db.select({
    id: topics.id,
    name: topics.name,
    subjectId: subjects.id,
    subjectName: subjects.name,
  })
    .from(topics)
    .innerJoin(subjects, eq(topics.subjectId, subjects.id))
    .where(eq(topics.id, input.topicId))
    .limit(1);

  if (!selectedTopic) throw new ApiError(400, 'INVALID_TOPIC', 'Topic was not found.');

  const questions = getKeyedQuestions(
    selectedTopic.id,
    selectedTopic.subjectName,
    selectedTopic.name,
    input.mode,
    input.submissionId,
    input.paperId,
  );
  if (!questions) {
    throw new ApiError(409, 'QUESTION_SET_UNAVAILABLE', 'The question set is unavailable.');
  }

  const submittedByKey = new Map(input.answers.map((answer) => [answer.questionKey, answer]));
  if (submittedByKey.size !== input.answers.length
    || input.answers.length !== questions.length
    || questions.some((question) => !submittedByKey.has(question.questionKey))) {
    throw new ApiError(400, 'INVALID_ANSWER_SET', 'Submit exactly one answer for every question.');
  }

  const gradedAnswers = questions.map((question, index) => {
    const submitted = submittedByKey.get(question.questionKey)!;
    return {
      questionKey: question.questionKey,
      questionIndex: index,
      submittedAnswer: submitted.answer,
      isCorrect: gradeQuestion(question, submitted.answer),
    };
  });
  const correctAnswers = gradedAnswers.filter((answer) => answer.isCorrect).length;
  const percentCorrect = calculatePercentCorrect(correctAnswers, questions.length);
  const resultingMemoryScore = calculateMemoryScore(percentCorrect);
  const now = new Date();

  const result = await db.transaction(async (transaction) => {
    const loadStoredAnswerGrading = (attemptId: string) => transaction.select({
      questionKey: quizAttemptAnswers.questionKey,
      questionIndex: quizAttemptAnswers.questionIndex,
      isCorrect: quizAttemptAnswers.isCorrect,
    })
      .from(quizAttemptAnswers)
      .where(eq(quizAttemptAnswers.attemptId, attemptId))
      .orderBy(asc(quizAttemptAnswers.questionIndex));

    const [prior] = await transaction.select({
      id: quizAttempts.id,
      submissionId: quizAttempts.submissionId,
      userId: quizAttempts.userId,
      topicId: quizAttempts.topicId,
      mode: quizAttempts.quizMode,
      correctAnswers: quizAttempts.correctAnswers,
      totalQuestions: quizAttempts.totalQuestions,
      percentCorrect: quizAttempts.percentCorrect,
      resultingMemoryScore: quizAttempts.resultingMemoryScore,
      submittedAt: quizAttempts.submittedAt,
    })
      .from(quizAttempts)
      .where(eq(quizAttempts.submissionId, input.submissionId))
      .limit(1);

    if (prior) {
      if (prior.userId !== userId) {
        throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');
      }
      return {
        ...prior,
        idempotentReplay: true,
        answers: await loadStoredAnswerGrading(prior.id),
      };
    }

    const [attempt] = await transaction.insert(quizAttempts).values({
      id: randomUUID(),
      submissionId: input.submissionId,
      userId,
      subjectId: selectedTopic.subjectId,
      topicId: selectedTopic.id,
      quizMode: input.mode,
      questionSetVersion: 'v1',
      correctAnswers,
      totalQuestions: questions.length,
      percentCorrect,
      resultingMemoryScore,
      startedAt: input.startedAt ? new Date(input.startedAt) : null,
      submittedAt: now,
    }).onConflictDoNothing({ target: quizAttempts.submissionId }).returning({
      id: quizAttempts.id,
      submissionId: quizAttempts.submissionId,
      userId: quizAttempts.userId,
      topicId: quizAttempts.topicId,
      mode: quizAttempts.quizMode,
      correctAnswers: quizAttempts.correctAnswers,
      totalQuestions: quizAttempts.totalQuestions,
      percentCorrect: quizAttempts.percentCorrect,
      resultingMemoryScore: quizAttempts.resultingMemoryScore,
      submittedAt: quizAttempts.submittedAt,
    });

    if (!attempt) {
      const [racedAttempt] = await transaction.select({
        id: quizAttempts.id,
        submissionId: quizAttempts.submissionId,
        userId: quizAttempts.userId,
        topicId: quizAttempts.topicId,
        mode: quizAttempts.quizMode,
        correctAnswers: quizAttempts.correctAnswers,
        totalQuestions: quizAttempts.totalQuestions,
        percentCorrect: quizAttempts.percentCorrect,
        resultingMemoryScore: quizAttempts.resultingMemoryScore,
        submittedAt: quizAttempts.submittedAt,
      }).from(quizAttempts).where(eq(quizAttempts.submissionId, input.submissionId)).limit(1);

      if (!racedAttempt || racedAttempt.userId !== userId) {
        throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');
      }
      return {
        ...racedAttempt,
        idempotentReplay: true,
        answers: await loadStoredAnswerGrading(racedAttempt.id),
      };
    }

    await transaction.insert(quizAttemptAnswers).values(gradedAnswers.map((answer) => ({
      attemptId: attempt.id,
      ...answer,
    })));

    await transaction.insert(userTopicProgress).values({
      userId,
      topicId: selectedTopic.id,
      memoryScore: resultingMemoryScore,
      lastReviewedAt: now,
      nextReviewAt: calculateNextReviewAt(resultingMemoryScore, now),
      quizAttempts: 1,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [userTopicProgress.userId, userTopicProgress.topicId],
      set: {
        memoryScore: resultingMemoryScore,
        lastReviewedAt: now,
        nextReviewAt: calculateNextReviewAt(resultingMemoryScore, now),
        quizAttempts: sql`${userTopicProgress.quizAttempts} + 1`,
        updatedAt: now,
      },
    });

    return {
      ...attempt,
      idempotentReplay: false,
      answers: gradedAnswers.map(({ questionKey, questionIndex, isCorrect }) => ({
        questionKey,
        questionIndex,
        isCorrect,
      })),
    };
  });

  return context.json(
    buildQuizAttemptResponse(result),
    result.idempotentReplay ? 200 : 201,
  );
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
      })),
    })),
  });
});

export { api as apiV1 };
