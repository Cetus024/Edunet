import { and, asc, eq } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { onboardingProfiles, profiles, userTopicProgress } from '../../../../database/schema/learning.js';
import { ApiError } from '../errors.js';
import { isRecipientRole, type EnquiryActor } from '../lib/enquiries.js';
import { loadEnquiryActor } from './enquiries.js';

export type TeacherStudent = {
  id: string;
  name: string;
  email: string;
  topicId: string | null;
  topicName: string | null;
};

export type StudentConceptWebResponse = {
  student: { id: string; name: string };
  subject: { id: string; name: string; icon: string | null };
  topics: Array<{
    id: string;
    name: string;
    memoryScore: number | null;
    lastReviewedAt: Date | null;
    nextReviewAt: Date | null;
    quizAttempts: number;
  }>;
};

/**
 * Loads the calling teacher/tutor's own school+subject scope. Reuses the
 * enquiries actor loader since it already resolves exactly this (real
 * onboarded role/school/subject, with the same "complete onboarding first"
 * guard), rather than duplicating that query.
 */
async function loadTeacherActor(teacherUserId: string): Promise<EnquiryActor> {
  const actor = await loadEnquiryActor(teacherUserId);
  if (!isRecipientRole(actor.role)) {
    throw new ApiError(403, 'TEACHER_ONLY', 'Only teachers and tutors have a student roster.');
  }
  return actor;
}

/**
 * A teacher's roster is every student at the same school who chose the same
 * subject during onboarding. There is no explicit class-enrollment table -
 * this school+subject match is the lightweight, real stand-in for one.
 */
export async function listStudentsForTeacher(teacherUserId: string): Promise<TeacherStudent[]> {
  const teacher = await loadTeacherActor(teacherUserId);

  const rows = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    topicId: onboardingProfiles.topicId,
    topicName: topics.name,
  })
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

  return rows;
}

export async function getStudentConceptWebForTeacher(
  teacherUserId: string,
  studentId: string,
): Promise<StudentConceptWebResponse> {
  const teacher = await loadTeacherActor(teacherUserId);

  const [student] = await db.select({
    id: users.id,
    name: users.name,
    schoolId: profiles.schoolId,
    subjectId: onboardingProfiles.subjectId,
  })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .innerJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .where(and(eq(profiles.userId, studentId), eq(profiles.role, 'student')))
    .limit(1);

  if (!student || student.schoolId !== teacher.schoolId || student.subjectId !== teacher.subjectId) {
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
    memoryScore: userTopicProgress.memoryScore,
    lastReviewedAt: userTopicProgress.lastReviewedAt,
    nextReviewAt: userTopicProgress.nextReviewAt,
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
      return {
        id: topic.id,
        name: topic.name,
        memoryScore: progress?.memoryScore ?? null,
        lastReviewedAt: progress?.lastReviewedAt ?? null,
        nextReviewAt: progress?.nextReviewAt ?? null,
        quizAttempts: progress?.quizAttempts ?? 0,
      };
    }),
  };
}
