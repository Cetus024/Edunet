import { and, asc, eq, inArray, isNotNull, sql } from 'drizzle-orm';

import { db } from '../../../../packages/database/index.js';
import { users } from '../../../../packages/database/schema/auth.js';
import { subjects, topics } from '../../../../packages/database/schema/catalog.js';
import {
  onboardingProfiles,
  profiles,
  quizAttempts,
  quizAttemptAnswers,
  quizAttemptQuestions,
  schoolClasses,
  studentClassAssignments,
  teachingScopes,
  userTopicModeProgress,
  userTopicProgress,
} from '../../../../packages/database/schema/learning.js';
import { ApiError } from '../errors.js';
import { summarizeClassTopic } from '../lib/class-concept-web.js';
import {
  PHASE1_PARAMETERS,
  calculateConceptMemory,
  calculateEssayMastery,
  calculateMcqMastery,
  type ModeProgressInput,
} from '../lib/knowledge-model.js';
import { resolveCurriculumTopic } from '../../../../apps/web/lib/curriculum.js';

export type TeacherStudent = {
  id: string;
  name: string;
  email: string;
  topicId: string | null;
  topicName: string | null;
};

type TeacherActor = {
  userId: string;
  schoolId: string;
  subjectId: string;
  classId: string | null;
  scopeId: string | null;
  audienceLabel: string;
};

export type StudentConceptWebResponse = {
  student: { id: string; name: string };
  subject: { id: string; name: string; icon: string | null };
  topics: Array<{
    id: string;
    name: string;
    memoryScore: number | null;
    modeScores: ReturnType<typeof calculateConceptMemory>['modes'];
    recommendedMode: 'mcq' | 'essay' | null;
    reviewNow: boolean;
    lastReviewedAt: Date | null;
    nextReviewAt: Date | null;
    quizAttempts: number;
    subtopics?: Array<{
      id: string;
      name: string;
      syllabusCode?: string;
      memoryScore: number | null;
    }>;
  }>;
};

export type TeacherConceptWebResponse = {
  cohortSize: number;
  audience: { kind: 'school' | 'class'; id: string; label: string };
  subject: { id: string; name: string; icon: string | null };
  topics: Array<{
    id: string;
    name: string;
    memoryScore: number | null;
    participatingStudents: number;
    lastReviewedAt: Date | null;
    nextReviewAt: Date | null;
    quizAttempts: number;
    subtopics?: Array<{
      id: string;
      name: string;
      syllabusCode?: string;
      memoryScore: number | null;
    }>;
  }>;
};

export async function requireTeacherProfile(teacherUserId: string) {
  const [profile] = await db.select({
    userId: profiles.userId,
    schoolId: profiles.schoolId,
    onboardingCompleted: profiles.onboardingCompleted,
  }).from(profiles)
    .where(and(eq(profiles.userId, teacherUserId), eq(profiles.role, 'teacher')))
    .limit(1);

  if (!profile) throw new ApiError(403, 'TEACHER_ONLY', 'Only teachers can access this resource.');
  if (!profile.onboardingCompleted) {
    throw new ApiError(409, 'ONBOARDING_REQUIRED', 'Complete onboarding before using teacher tools.');
  }
  return profile;
}

export async function loadTeacherActor(
  teacherUserId: string,
  selector: { scopeId: string } | { subjectId: string },
): Promise<TeacherActor> {
  const teacher = await requireTeacherProfile(teacherUserId);

  if ('scopeId' in selector) {
    const [scope] = await db.select({
      scopeId: teachingScopes.id,
      subjectId: teachingScopes.subjectId,
      classId: teachingScopes.classId,
      schoolId: schoolClasses.schoolId,
      classroomName: schoolClasses.name,
    }).from(teachingScopes)
      .innerJoin(schoolClasses, eq(schoolClasses.id, teachingScopes.classId))
      .where(and(eq(teachingScopes.id, selector.scopeId), eq(teachingScopes.userId, teacherUserId)))
      .limit(1);

    if (!scope || scope.schoolId !== teacher.schoolId) {
      throw new ApiError(403, 'INVALID_TEACHING_SCOPE', 'This teaching context is not available to your account.');
    }
    return {
      userId: teacherUserId,
      schoolId: scope.schoolId,
      subjectId: scope.subjectId,
      classId: scope.classId,
      scopeId: scope.scopeId,
      audienceLabel: scope.classroomName,
    };
  }

  const [authorizedSubject] = await db.select({
    subjectId: teachingScopes.subjectId,
    schoolId: schoolClasses.schoolId,
  }).from(teachingScopes)
    .innerJoin(schoolClasses, eq(schoolClasses.id, teachingScopes.classId))
    .where(and(
      eq(teachingScopes.userId, teacherUserId),
      eq(teachingScopes.subjectId, selector.subjectId),
      eq(schoolClasses.schoolId, teacher.schoolId),
    ))
    .limit(1);

  if (!authorizedSubject) {
    throw new ApiError(403, 'SUBJECT_NOT_ASSIGNED', 'This subject is not assigned to your account.');
  }
  return {
    userId: teacherUserId,
    schoolId: teacher.schoolId,
    subjectId: authorizedSubject.subjectId,
    classId: null,
    scopeId: null,
    audienceLabel: 'Whole school',
  };
}

const studentRosterSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  topicId: onboardingProfiles.topicId,
  topicName: topics.name,
};

async function listStudentsInClass(classId: string): Promise<TeacherStudent[]> {
  return db.select(studentRosterSelection)
    .from(studentClassAssignments)
    .innerJoin(schoolClasses, eq(schoolClasses.id, studentClassAssignments.classId))
    .innerJoin(profiles, eq(profiles.userId, studentClassAssignments.studentUserId))
    .innerJoin(users, eq(users.id, profiles.userId))
    .leftJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .leftJoin(topics, eq(topics.id, onboardingProfiles.topicId))
    .where(and(
      eq(studentClassAssignments.classId, classId),
      eq(profiles.schoolId, schoolClasses.schoolId),
      eq(profiles.role, 'student'),
    ))
    .orderBy(asc(users.name));
}

async function listStudentsInSchoolSubject(schoolId: string, subjectId: string): Promise<TeacherStudent[]> {
  return db.selectDistinct(studentRosterSelection)
    .from(studentClassAssignments)
    .innerJoin(schoolClasses, eq(schoolClasses.id, studentClassAssignments.classId))
    .innerJoin(teachingScopes, and(
      eq(teachingScopes.classId, studentClassAssignments.classId),
      eq(teachingScopes.subjectId, subjectId),
    ))
    .innerJoin(profiles, eq(profiles.userId, studentClassAssignments.studentUserId))
    .innerJoin(users, eq(users.id, profiles.userId))
    .leftJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .leftJoin(topics, eq(topics.id, onboardingProfiles.topicId))
    .where(and(
      eq(schoolClasses.schoolId, schoolId),
      eq(profiles.schoolId, schoolClasses.schoolId),
      eq(profiles.role, 'student'),
    ))
    .orderBy(asc(users.name));
}

export async function listStudentsForTeacher(teacherUserId: string, scopeId: string): Promise<TeacherStudent[]> {
  const teacher = await loadTeacherActor(teacherUserId, { scopeId });
  return listStudentsInClass(teacher.classId!);
}

export async function getTeacherConceptWeb(
  teacherUserId: string,
  view: { view: 'school'; subjectId: string } | { view: 'class'; scopeId: string },
): Promise<TeacherConceptWebResponse> {
  const teacher = view.view === 'school'
    ? await loadTeacherActor(teacherUserId, { subjectId: view.subjectId })
    : await loadTeacherActor(teacherUserId, { scopeId: view.scopeId });
  const roster = teacher.classId
    ? await listStudentsInClass(teacher.classId)
    : await listStudentsInSchoolSubject(teacher.schoolId, teacher.subjectId);

  const [subjectRow] = await db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
    .from(subjects).where(eq(subjects.id, teacher.subjectId)).limit(1);
  if (!subjectRow) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject was not found.');

  const topicRows = await db.select({ id: topics.id, name: topics.name })
    .from(topics).where(eq(topics.subjectId, teacher.subjectId)).orderBy(asc(topics.position));
  const [progressRows, reminderRows, subtopicQuestionRows] = roster.length === 0
    ? [[], [], []]
    : await Promise.all([
        db.select({
          userId: userTopicModeProgress.userId,
          topicId: userTopicModeProgress.topicId,
          mode: userTopicModeProgress.assessmentMode,
          mastery: userTopicModeProgress.mastery,
          lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
          quizAttempts: userTopicModeProgress.quizAttempts,
        }).from(userTopicModeProgress)
          .where(inArray(userTopicModeProgress.userId, roster.map((student) => student.id))),
        db.select({ topicId: userTopicProgress.topicId, nextReviewAt: userTopicProgress.nextReviewAt })
          .from(userTopicProgress)
          .where(inArray(userTopicProgress.userId, roster.map((student) => student.id))),
        db.select({
          userId: quizAttempts.userId,
          subtopicId: quizAttemptQuestions.subtopicId,
          mode: quizAttempts.quizMode,
          isCorrect: quizAttemptAnswers.isCorrect,
          marksObtained: quizAttemptAnswers.marksObtained,
          maximumMarks: quizAttemptAnswers.maximumMarks,
          completedAt: sql<Date>`coalesce(${quizAttempts.completedAt}, ${quizAttempts.submittedAt}, ${quizAttempts.startedAt})`,
        })
          .from(quizAttempts)
          .innerJoin(quizAttemptQuestions, eq(quizAttemptQuestions.attemptId, quizAttempts.id))
          .innerJoin(
            quizAttemptAnswers,
            and(
              eq(quizAttemptAnswers.attemptId, quizAttempts.id),
              eq(quizAttemptAnswers.questionIndex, quizAttemptQuestions.questionIndex),
            ),
          )
          .where(
            and(
              inArray(quizAttempts.userId, roster.map((student) => student.id)),
              isNotNull(quizAttemptQuestions.subtopicId),
            ),
          ),
      ]);

  const progressByTopic = new Map<string, typeof progressRows>();
  for (const progress of progressRows) {
    const rows = progressByTopic.get(progress.topicId) ?? [];
    rows.push(progress);
    progressByTopic.set(progress.topicId, rows);
  }
  const remindersByTopic = new Map<string, Date[]>();
  for (const reminder of reminderRows) {
    const dates = remindersByTopic.get(reminder.topicId) ?? [];
    dates.push(reminder.nextReviewAt);
    remindersByTopic.set(reminder.topicId, dates);
  }

  // Calculate per-student subtopic scores to aggregate for the class
  const classSubtopicScores = new Map<string, number[]>();
  const subtopicAnswersByStudent = new Map<string, Map<string, typeof subtopicQuestionRows>>();
  for (const row of subtopicQuestionRows) {
    if (!row.subtopicId) continue;
    const studentMap = subtopicAnswersByStudent.get(row.subtopicId) ?? new Map();
    const studentList = studentMap.get(row.userId) ?? [];
    studentList.push(row);
    studentMap.set(row.userId, studentList);
    subtopicAnswersByStudent.set(row.subtopicId, studentMap);
  }

  const now = new Date();
  for (const [subtopicId, studentMap] of subtopicAnswersByStudent.entries()) {
    const scores: number[] = [];
    for (const answers of studentMap.values()) {
      const mcqAnswers = answers.filter((a) => a.mode === 'mcq' || a.isCorrect !== null);
      const essayAnswers = answers.filter((a) => a.mode === 'essay' && a.maximumMarks !== null);
      const modeInputs: ModeProgressInput[] = [];

      if (mcqAnswers.length > 0) {
        const correct = mcqAnswers.filter((a) => a.isCorrect === true).length;
        const wrong = mcqAnswers.length - correct;
        const latestDate = mcqAnswers.reduce<Date>(
          (latest, a) => {
            const d = a.completedAt instanceof Date ? a.completedAt : new Date(a.completedAt ?? 0);
            return d.getTime() > latest.getTime() ? d : latest;
          },
          mcqAnswers[0]?.completedAt instanceof Date ? mcqAnswers[0].completedAt : new Date(mcqAnswers[0]?.completedAt ?? 0),
        );
        const mcqCalc = calculateMcqMastery({
          previousMastery: PHASE1_PARAMETERS.initialMastery,
          elapsedDays: 0,
          correct,
          wrong,
        });
        modeInputs.push({ mode: 'mcq', mastery: mcqCalc.posteriorMastery, lastUpdatedAt: latestDate, quizAttempts: 1 });
      }

      if (essayAnswers.length > 0) {
        const marksObtained = essayAnswers.reduce((sum, a) => sum + (a.marksObtained ?? 0), 0);
        const maximumMarks = essayAnswers.reduce((sum, a) => sum + (a.maximumMarks ?? 0), 0);
        const latestDate = essayAnswers.reduce<Date>(
          (latest, a) => {
            const d = a.completedAt instanceof Date ? a.completedAt : new Date(a.completedAt ?? 0);
            return d.getTime() > latest.getTime() ? d : latest;
          },
          essayAnswers[0]?.completedAt instanceof Date ? essayAnswers[0].completedAt : new Date(essayAnswers[0]?.completedAt ?? 0),
        );
        const essayCalc = calculateEssayMastery({
          previousMastery: PHASE1_PARAMETERS.initialMastery,
          elapsedDays: 0,
          marksObtained,
          maximumMarks,
        });
        modeInputs.push({ mode: 'essay', mastery: essayCalc.posteriorMastery, lastUpdatedAt: latestDate, quizAttempts: 1 });
      }

      if (modeInputs.length > 0) {
        const mem = calculateConceptMemory(modeInputs, now);
        if (mem.conceptMemoryScore !== null) scores.push(mem.conceptMemoryScore);
      }
    }
    if (scores.length > 0) classSubtopicScores.set(subtopicId, scores);
  }

  return {
    cohortSize: roster.length,
    audience: {
      kind: view.view,
      id: view.view === 'school' ? teacher.schoolId : teacher.classId!,
      label: teacher.audienceLabel,
    },
    subject: subjectRow,
    topics: topicRows.map((topic) => {
      const summarized = summarizeClassTopic(
        roster.length,
        progressByTopic.get(topic.id) ?? [],
        now,
        remindersByTopic.get(topic.id) ?? [],
      );
      const curriculumTopic = resolveCurriculumTopic(topic.id) ?? resolveCurriculumTopic(topic.name);
      const subtopicsWithScore = curriculumTopic?.subtopics.map((child) => {
        const studentScores = classSubtopicScores.get(child.id) ?? [];
        const subtopicClassAverage = studentScores.length > 0
          ? Math.round(studentScores.reduce((sum, s) => sum + s, 0) / (roster.length || 1))
          : null;
        return {
          id: child.id,
          name: child.name,
          syllabusCode: child.syllabusCode,
          memoryScore: subtopicClassAverage,
        };
      }) ?? [];

      const startedSubtopics = subtopicsWithScore.filter((child) => child.memoryScore !== null);
      const themeMemoryScore = startedSubtopics.length > 0
        ? Math.round(startedSubtopics.reduce((sum, child) => sum + child.memoryScore!, 0) / startedSubtopics.length)
        : (summarized.memoryScore ?? null);

      return {
        id: topic.id,
        name: topic.name,
        ...summarized,
        memoryScore: themeMemoryScore,
        subtopics: subtopicsWithScore,
      };
    }),
  };
}

export async function getStudentConceptWebForTeacher(
  teacherUserId: string,
  studentId: string,
  scopeId: string,
): Promise<StudentConceptWebResponse> {
  const teacher = await loadTeacherActor(teacherUserId, { scopeId });
  const roster = await listStudentsInClass(teacher.classId!);
  const student = roster.find((candidate) => candidate.id === studentId);
  if (!student) throw new ApiError(403, 'STUDENT_NOT_IN_CLASS', 'This student is not in the selected class.');

  const [subjectRow] = await db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
    .from(subjects).where(eq(subjects.id, teacher.subjectId)).limit(1);
  if (!subjectRow) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject was not found.');
  const topicRows = await db.select({ id: topics.id, name: topics.name })
    .from(topics).where(eq(topics.subjectId, teacher.subjectId)).orderBy(asc(topics.position));
  const [progressRows, reminderRows, studentSubtopicQuestions] = await Promise.all([
    db.select({
      topicId: userTopicModeProgress.topicId,
      mode: userTopicModeProgress.assessmentMode,
      mastery: userTopicModeProgress.mastery,
      lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
      quizAttempts: userTopicModeProgress.quizAttempts,
    }).from(userTopicModeProgress).where(eq(userTopicModeProgress.userId, studentId)),
    db.select({ topicId: userTopicProgress.topicId, nextReviewAt: userTopicProgress.nextReviewAt })
      .from(userTopicProgress).where(eq(userTopicProgress.userId, studentId)),
    db.select({
      subtopicId: quizAttemptQuestions.subtopicId,
      mode: quizAttempts.quizMode,
      isCorrect: quizAttemptAnswers.isCorrect,
      marksObtained: quizAttemptAnswers.marksObtained,
      maximumMarks: quizAttemptAnswers.maximumMarks,
      completedAt: sql<Date>`coalesce(${quizAttempts.completedAt}, ${quizAttempts.submittedAt}, ${quizAttempts.startedAt})`,
    })
      .from(quizAttempts)
      .innerJoin(quizAttemptQuestions, eq(quizAttemptQuestions.attemptId, quizAttempts.id))
      .innerJoin(
        quizAttemptAnswers,
        and(
          eq(quizAttemptAnswers.attemptId, quizAttempts.id),
          eq(quizAttemptAnswers.questionIndex, quizAttemptQuestions.questionIndex),
        ),
      )
      .where(
        and(
          eq(quizAttempts.userId, studentId),
          isNotNull(quizAttemptQuestions.subtopicId),
        ),
      ),
  ]);
  const progressByTopic = new Map<string, typeof progressRows>();
  for (const progress of progressRows) {
    const rows = progressByTopic.get(progress.topicId) ?? [];
    rows.push(progress);
    progressByTopic.set(progress.topicId, rows);
  }
  const reminderByTopic = new Map(reminderRows.map((row) => [row.topicId, row.nextReviewAt]));

  const studentSubtopicScores = new Map<string, number | null>();
  const answersBySubtopic = new Map<string, typeof studentSubtopicQuestions>();
  for (const row of studentSubtopicQuestions) {
    if (!row.subtopicId) continue;
    const list = answersBySubtopic.get(row.subtopicId) ?? [];
    list.push(row);
    answersBySubtopic.set(row.subtopicId, list);
  }

  const calculatedAt = new Date();
  for (const [subtopicId, answers] of answersBySubtopic.entries()) {
    const mcqAnswers = answers.filter((a) => a.mode === 'mcq' || a.isCorrect !== null);
    const essayAnswers = answers.filter((a) => a.mode === 'essay' && a.maximumMarks !== null);
    const modeInputs: ModeProgressInput[] = [];

    if (mcqAnswers.length > 0) {
      const correct = mcqAnswers.filter((a) => a.isCorrect === true).length;
      const wrong = mcqAnswers.length - correct;
      const latestDate = mcqAnswers.reduce<Date>(
        (latest, a) => {
          const d = a.completedAt instanceof Date ? a.completedAt : new Date(a.completedAt ?? 0);
          return d.getTime() > latest.getTime() ? d : latest;
        },
        mcqAnswers[0]?.completedAt instanceof Date ? mcqAnswers[0].completedAt : new Date(mcqAnswers[0]?.completedAt ?? 0),
      );
      const mcqCalc = calculateMcqMastery({
        previousMastery: PHASE1_PARAMETERS.initialMastery,
        elapsedDays: 0,
        correct,
        wrong,
      });
      modeInputs.push({ mode: 'mcq', mastery: mcqCalc.posteriorMastery, lastUpdatedAt: latestDate, quizAttempts: 1 });
    }

    if (essayAnswers.length > 0) {
      const marksObtained = essayAnswers.reduce((sum, a) => sum + (a.marksObtained ?? 0), 0);
      const maximumMarks = essayAnswers.reduce((sum, a) => sum + (a.maximumMarks ?? 0), 0);
      const latestDate = essayAnswers.reduce<Date>(
        (latest, a) => {
          const d = a.completedAt instanceof Date ? a.completedAt : new Date(a.completedAt ?? 0);
          return d.getTime() > latest.getTime() ? d : latest;
        },
        essayAnswers[0]?.completedAt instanceof Date ? essayAnswers[0].completedAt : new Date(essayAnswers[0]?.completedAt ?? 0),
      );
      const essayCalc = calculateEssayMastery({
        previousMastery: PHASE1_PARAMETERS.initialMastery,
        elapsedDays: 0,
        marksObtained,
        maximumMarks,
      });
      modeInputs.push({ mode: 'essay', mastery: essayCalc.posteriorMastery, lastUpdatedAt: latestDate, quizAttempts: 1 });
    }

    if (modeInputs.length > 0) {
      const mem = calculateConceptMemory(modeInputs, calculatedAt);
      studentSubtopicScores.set(subtopicId, mem.conceptMemoryScore);
    }
  }

  return {
    student: { id: student.id, name: student.name },
    subject: subjectRow,
    topics: topicRows.map((topic) => {
      const rows = progressByTopic.get(topic.id) ?? [];
      const concept = calculateConceptMemory(rows, calculatedAt);
      const nextReviewAt = reminderByTopic.get(topic.id) ?? null;
      const lastReviewedAt = rows.reduce<Date | null>((latest, row) => (
        latest === null || row.lastUpdatedAt > latest ? row.lastUpdatedAt : latest
      ), null);

      const curriculumTopic = resolveCurriculumTopic(topic.id) ?? resolveCurriculumTopic(topic.name);
      const subtopicsWithScore = curriculumTopic?.subtopics.map((child) => ({
        id: child.id,
        name: child.name,
        syllabusCode: child.syllabusCode,
        memoryScore: studentSubtopicScores.get(child.id) ?? null,
      })) ?? [];

      const startedSubtopics = subtopicsWithScore.filter((child) => child.memoryScore !== null);
      const themeMemoryScore = startedSubtopics.length > 0
        ? Math.round(startedSubtopics.reduce((sum, child) => sum + child.memoryScore!, 0) / startedSubtopics.length)
        : (concept.conceptMemoryScore ?? null);

      return {
        id: topic.id,
        name: topic.name,
        memoryScore: themeMemoryScore,
        modeScores: concept.modes,
        recommendedMode: concept.recommendedMode,
        reviewNow: concept.conceptMemory !== null && (
          concept.conceptMemory <= PHASE1_PARAMETERS.memoryThreshold
          || (nextReviewAt !== null && nextReviewAt <= calculatedAt)
        ),
        lastReviewedAt,
        nextReviewAt,
        quizAttempts: rows.reduce((sum, row) => sum + row.quizAttempts, 0),
        subtopics: subtopicsWithScore,
      };
    }),
  };
}
