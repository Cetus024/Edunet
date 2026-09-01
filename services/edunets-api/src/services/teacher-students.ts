import { and, asc, eq, ilike, inArray, ne, or } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { classroomEnrollments, onboardingProfiles, profiles, teachingScopes, userTopicProgress } from '../../../../database/schema/learning.js';
import { ApiError } from '../errors.js';
import { summarizeClassTopic } from '../lib/class-concept-web.js';
import { calculateDynamicProgress } from '../lib/knowledge-model.js';
import { isRecipientRole, type EnquiryActor } from '../lib/enquiries.js';
import { loadEnquiryActor } from './enquiries.js';

export type TeacherStudent = {
  id: string;
  name: string;
  email: string;
  topicId: string | null;
  topicName: string | null;
};

export type StudentSearchResult = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  subjectId: string | null;
  inClass: boolean;
};

type TeacherActor = EnquiryActor & { scopeId: string | null };

export type StudentConceptWebResponse = {
  student: { id: string; name: string };
  subject: { id: string; name: string; icon: string | null };
  topics: Array<{
    id: string;
    name: string;
    memoryScore: number | null;
    masteryScore: number | null;
    stabilityDays: number | null;
    successfulReviews: number;
    reviewNow: boolean;
    lastReviewedAt: Date | null;
    nextReviewAt: Date | null;
    quizAttempts: number;
  }>;
};

export type ClassConceptWebResponse = {
  classSize: number;
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

/**
 * Loads the calling teacher's own school+subject scope. Reuses the
 * enquiries actor loader since it already resolves exactly this (real
 * onboarded role/school/subject, with the same "complete onboarding first"
 * guard), rather than duplicating that query.
 */
export async function loadTeacherActor(teacherUserId: string, scopeId?: string): Promise<TeacherActor> {
  const actor = await loadEnquiryActor(teacherUserId);
  if (!isRecipientRole(actor.role)) {
    throw new ApiError(403, 'TEACHER_ONLY', 'Only teachers have a student roster.');
  }
  if (!scopeId) return { ...actor, scopeId: null };

  const [scope] = await db.select({
    userId: teachingScopes.userId,
    schoolId: teachingScopes.schoolId,
    subjectId: teachingScopes.subjectId,
  })
    .from(teachingScopes)
    .where(and(eq(teachingScopes.id, scopeId), eq(teachingScopes.userId, teacherUserId)))
    .limit(1);
  if (!scope) throw new ApiError(403, 'INVALID_TEACHING_SCOPE', 'This teaching context is not available to your account.');
  return { ...actor, schoolId: scope.schoolId, subjectId: scope.subjectId, scopeId };
}

const studentRosterSelection = {
  id: users.id,
  name: users.name,
  email: users.email,
  topicId: onboardingProfiles.topicId,
  topicName: topics.name,
};

/**
 * A teacher's roster is every student at the same school who chose the same
 * subject during onboarding, UNIONed with anyone the teacher has explicitly
 * added via classroom_enrollment (see addStudentToScope) - the manual
 * override for a student who hasn't picked this exact subject, or is at a
 * different school. Explicit adds only apply within a specific teaching
 * scope (a specific classroom), so they're skipped when no scopeId is
 * resolved (see loadTeacherActor).
 */
export async function listStudentsInScope(teacher: TeacherActor): Promise<TeacherStudent[]> {
  const implicitMatchRows = await db.select(studentRosterSelection)
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .innerJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .leftJoin(topics, eq(topics.id, onboardingProfiles.topicId))
    .where(and(
      eq(profiles.role, 'student'),
      eq(profiles.schoolId, teacher.schoolId),
      eq(onboardingProfiles.subjectId, teacher.subjectId),
    ))
    .orderBy(asc(users.name));

  if (!teacher.scopeId) return implicitMatchRows;

  // leftJoin (not inner) on onboardingProfiles here: an explicitly-added
  // student who hasn't finished onboarding yet should still show up in the
  // roster the teacher chose to add them to, just with a null topic.
  const explicitRows = await db.select(studentRosterSelection)
    .from(classroomEnrollments)
    .innerJoin(profiles, eq(profiles.userId, classroomEnrollments.studentUserId))
    .innerJoin(users, eq(users.id, profiles.userId))
    .leftJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .leftJoin(topics, eq(topics.id, onboardingProfiles.topicId))
    .where(and(
      eq(classroomEnrollments.teachingScopeId, teacher.scopeId),
      eq(profiles.role, 'student'),
    ))
    .orderBy(asc(users.name));

  const byId = new Map<string, TeacherStudent>();
  for (const row of [...implicitMatchRows, ...explicitRows]) byId.set(row.id, row);
  return [...byId.values()].sort((first, second) => first.name.localeCompare(second.name));
}

export async function listStudentsForTeacher(teacherUserId: string, scopeId?: string): Promise<TeacherStudent[]> {
  const teacher = await loadTeacherActor(teacherUserId, scopeId);
  return listStudentsInScope(teacher);
}

/**
 * Students at the teacher's school who are candidates to add to the current
 * class - matched by name/email substring, tagged with whether they're
 * already in this scope's roster (implicit or explicit) so the UI can grey
 * them out instead of offering a duplicate add.
 */
export async function searchStudentsForTeacher(
  teacherUserId: string,
  query: string,
  scopeId: string,
): Promise<StudentSearchResult[]> {
  const teacher = await loadTeacherActor(teacherUserId, scopeId);
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const roster = await listStudentsInScope(teacher);
  const rosterIds = new Set(roster.map((student) => student.id));

  const rows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    schoolId: profiles.schoolId,
    subjectId: onboardingProfiles.subjectId,
  })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .leftJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .where(and(
      eq(profiles.role, 'student'),
      eq(profiles.schoolId, teacher.schoolId),
      ne(users.id, teacherUserId),
      or(ilike(users.name, `%${trimmed}%`), ilike(users.email, `%${trimmed}%`)),
    ))
    .orderBy(asc(users.name))
    .limit(15);

  return rows.map((row) => ({ ...row, inClass: rosterIds.has(row.id) }));
}

/** Adds a student to a specific classroom via explicit enrollment. Safe to
 * call for a student who already implicit-matches or is already enrolled -
 * both are no-ops. Restricted to students at the teacher's own school, same
 * boundary searchStudentsForTeacher's candidate list already enforces - this
 * check exists independently so a direct API call can't add a student the
 * search UI would never have surfaced. */
export async function addStudentToScope(teacherUserId: string, studentUserId: string, scopeId: string): Promise<void> {
  const teacher = await loadTeacherActor(teacherUserId, scopeId);

  const [student] = await db.select({ id: profiles.userId, schoolId: profiles.schoolId })
    .from(profiles)
    .where(and(eq(profiles.userId, studentUserId), eq(profiles.role, 'student')))
    .limit(1);
  if (!student) throw new ApiError(404, 'STUDENT_NOT_FOUND', 'That student account was not found.');
  if (student.schoolId !== teacher.schoolId) {
    throw new ApiError(403, 'STUDENT_NOT_AT_SCHOOL', 'This student is not at your school.');
  }

  await db.insert(classroomEnrollments).values({
    teachingScopeId: scopeId,
    studentUserId,
    addedAt: new Date(),
  }).onConflictDoNothing();
}

/** Removes a student's *explicit* enrollment only - a student who still
 * implicit-matches (same school + subject) will still appear in the
 * roster, since that half of membership isn't something this action owns. */
export async function removeStudentFromScope(teacherUserId: string, studentUserId: string, scopeId: string): Promise<void> {
  await loadTeacherActor(teacherUserId, scopeId);

  await db.delete(classroomEnrollments)
    .where(and(
      eq(classroomEnrollments.teachingScopeId, scopeId),
      eq(classroomEnrollments.studentUserId, studentUserId),
    ));
}

/**
 * Builds the teacher concept web from the entire school+subject roster.
 * A missing student/topic progress row contributes zero to the whole-class
 * average. If nobody has started a topic yet, its score stays null so the UI
 * can distinguish "not started" from a genuine class average of zero.
 */
export async function getClassConceptWebForTeacher(
  teacherUserId: string,
  scopeId?: string,
): Promise<ClassConceptWebResponse> {
  const teacher = await loadTeacherActor(teacherUserId, scopeId);
  const roster = await listStudentsInScope(teacher);

  const [subjectRow] = await db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
    .from(subjects)
    .where(eq(subjects.id, teacher.subjectId))
    .limit(1);

  if (!subjectRow) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject was not found.');

  const topicRows = await db.select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(eq(topics.subjectId, teacher.subjectId))
    .orderBy(asc(topics.position));

  const progressRows = roster.length === 0
    ? []
    : await db.select({
      topicId: userTopicProgress.topicId,
      mastery: userTopicProgress.mastery,
      stabilityDays: userTopicProgress.stabilityDays,
      lastReviewedAt: userTopicProgress.lastReviewedAt,
      quizAttempts: userTopicProgress.quizAttempts,
    })
      .from(userTopicProgress)
      .where(inArray(userTopicProgress.userId, roster.map((student) => student.id)));

  const progressByTopic = new Map<string, typeof progressRows>();
  for (const progress of progressRows) {
    const topicProgress = progressByTopic.get(progress.topicId) ?? [];
    topicProgress.push(progress);
    progressByTopic.set(progress.topicId, topicProgress);
  }

  return {
    classSize: roster.length,
    subject: subjectRow,
    topics: topicRows.map((topic) => {
      const topicProgress = progressByTopic.get(topic.id) ?? [];

      return {
        id: topic.id,
        name: topic.name,
        ...summarizeClassTopic(roster.length, topicProgress),
      };
    }),
  };
}

export async function getStudentConceptWebForTeacher(
  teacherUserId: string,
  studentId: string,
  scopeId?: string,
): Promise<StudentConceptWebResponse> {
  const teacher = await loadTeacherActor(teacherUserId, scopeId);

  const [student] = await db.select({ id: users.id, name: users.name })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(profiles.userId, studentId), eq(profiles.role, 'student')))
    .limit(1);

  // Membership (not a standalone school/subject check) is the source of
  // truth here, same as the roster/class-web endpoints - covers both an
  // implicit school+subject match and an explicit classroom_enrollment add.
  const roster = await listStudentsInScope(teacher);
  if (!student || !roster.some((rosterStudent) => rosterStudent.id === student.id)) {
    throw new ApiError(403, 'STUDENT_NOT_IN_ROSTER', 'This student is not in your roster.');
  }

  const [subjectRow] = await db.select({ id: subjects.id, name: subjects.name, icon: subjects.icon })
    .from(subjects)
    .where(eq(subjects.id, teacher.subjectId))
    .limit(1);

  if (!subjectRow) throw new ApiError(404, 'SUBJECT_NOT_FOUND', 'Subject was not found.');

  const topicRows = await db.select({ id: topics.id, name: topics.name })
    .from(topics)
    .where(eq(topics.subjectId, teacher.subjectId))
    .orderBy(asc(topics.position));

  const progressRows = await db.select({
    topicId: userTopicProgress.topicId,
    mastery: userTopicProgress.mastery,
    stabilityDays: userTopicProgress.stabilityDays,
    successfulReviews: userTopicProgress.successfulReviews,
    lastReviewedAt: userTopicProgress.lastReviewedAt,
    quizAttempts: userTopicProgress.quizAttempts,
  })
    .from(userTopicProgress)
    .where(eq(userTopicProgress.userId, studentId));

  const progressByTopic = new Map(progressRows.map((progress) => [progress.topicId, progress]));

  return {
    student: { id: student.id, name: student.name },
    subject: subjectRow,
    topics: topicRows.map((topic) => {
      const progress = progressByTopic.get(topic.id);
      const dynamic = progress
        ? calculateDynamicProgress(progress.mastery, progress.stabilityDays, progress.lastReviewedAt)
        : null;
      return {
        id: topic.id,
        name: topic.name,
        memoryScore: dynamic?.memoryScore ?? null,
        masteryScore: dynamic?.masteryScore ?? null,
        stabilityDays: progress?.stabilityDays ?? null,
        successfulReviews: progress?.successfulReviews ?? 0,
        reviewNow: dynamic?.reviewNow ?? false,
        lastReviewedAt: progress?.lastReviewedAt ?? null,
        nextReviewAt: dynamic?.nextReviewAt ?? null,
        quizAttempts: progress?.quizAttempts ?? 0,
      };
    }),
  };
}
