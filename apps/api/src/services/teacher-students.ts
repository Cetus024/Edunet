import { and, asc, eq, inArray } from 'drizzle-orm';

import { db } from '../../../../packages/database/index.js';
import { users } from '../../../../packages/database/schema/auth.js';
import { subjects, topics } from '../../../../packages/database/schema/catalog.js';
import {
  onboardingProfiles,
  profiles,
  schoolClasses,
  studentClassAssignments,
  teachingScopes,
  userTopicModeProgress,
  userTopicProgress,
} from '../../../../packages/database/schema/learning.js';
import { ApiError } from '../errors.js';
import { summarizeClassTopic } from '../lib/class-concept-web.js';
import { PHASE1_PARAMETERS, calculateConceptMemory } from '../lib/knowledge-model.js';

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
  const [progressRows, reminderRows] = roster.length === 0
    ? [[], []]
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

  return {
    cohortSize: roster.length,
    audience: {
      kind: view.view,
      id: view.view === 'school' ? teacher.schoolId : teacher.classId!,
      label: teacher.audienceLabel,
    },
    subject: subjectRow,
    topics: topicRows.map((topic) => ({
      id: topic.id,
      name: topic.name,
      ...summarizeClassTopic(
        roster.length,
        progressByTopic.get(topic.id) ?? [],
        new Date(),
        remindersByTopic.get(topic.id) ?? [],
      ),
    })),
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
  const [progressRows, reminderRows] = await Promise.all([
    db.select({
      topicId: userTopicModeProgress.topicId,
      mode: userTopicModeProgress.assessmentMode,
      mastery: userTopicModeProgress.mastery,
      lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
      quizAttempts: userTopicModeProgress.quizAttempts,
    }).from(userTopicModeProgress).where(eq(userTopicModeProgress.userId, studentId)),
    db.select({ topicId: userTopicProgress.topicId, nextReviewAt: userTopicProgress.nextReviewAt })
      .from(userTopicProgress).where(eq(userTopicProgress.userId, studentId)),
  ]);
  const progressByTopic = new Map<string, typeof progressRows>();
  for (const progress of progressRows) {
    const rows = progressByTopic.get(progress.topicId) ?? [];
    rows.push(progress);
    progressByTopic.set(progress.topicId, rows);
  }
  const reminderByTopic = new Map(reminderRows.map((row) => [row.topicId, row.nextReviewAt]));

  return {
    student: { id: student.id, name: student.name },
    subject: subjectRow,
    topics: topicRows.map((topic) => {
      const rows = progressByTopic.get(topic.id) ?? [];
      const calculatedAt = new Date();
      const concept = calculateConceptMemory(rows, calculatedAt);
      const nextReviewAt = reminderByTopic.get(topic.id) ?? null;
      const lastReviewedAt = rows.reduce<Date | null>((latest, row) => (
        latest === null || row.lastUpdatedAt > latest ? row.lastUpdatedAt : latest
      ), null);
      return {
        id: topic.id,
        name: topic.name,
        memoryScore: concept.conceptMemoryScore,
        modeScores: concept.modes,
        recommendedMode: concept.recommendedMode,
        reviewNow: concept.conceptMemory !== null && (
          concept.conceptMemory <= PHASE1_PARAMETERS.memoryThreshold
          || (nextReviewAt !== null && nextReviewAt <= calculatedAt)
        ),
        lastReviewedAt,
        nextReviewAt,
        quizAttempts: rows.reduce((sum, row) => sum + row.quizAttempts, 0),
      };
    }),
  };
}
