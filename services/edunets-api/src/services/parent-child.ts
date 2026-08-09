import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { onboardingProfiles, profiles } from '../../../../database/schema/learning.js';
import { ApiError } from '../errors.js';
import { getStudyStateForUser, type StudyStateSubject } from './study-state.js';

export type ParentChildResult = {
  status: 'linked' | 'pending';
  childName: string;
  childEmail: string;
  child: { id: string; name: string; email: string } | null;
  subjects: StudyStateSubject[];
  tutors: Array<{ id: string; name: string; role: 'teacher' | 'tutor'; subjectName: string | null }>;
};

/**
 * Resolves a parent's linked child (by the email they gave at onboarding)
 * to that child's real, read-only progress - the same subjects/topics/
 * memoryScore data the child's own dashboard and concept web read from.
 * Returns a "pending" result rather than 404ing when the child hasn't
 * created an EduNets account with that email yet, since that's an expected
 * step-order (a parent can onboard before their child does).
 */
export async function getChildForParent(parentUserId: string): Promise<ParentChildResult> {
  const [parent] = await db.select({
    role: profiles.role,
    childName: onboardingProfiles.childName,
    childEmail: onboardingProfiles.childEmail,
  })
    .from(profiles)
    .innerJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .where(eq(profiles.userId, parentUserId))
    .limit(1);

  if (!parent || parent.role !== 'parent') {
    throw new ApiError(403, 'PARENT_ONLY', 'Only parents have a linked child.');
  }
  if (!parent.childEmail) {
    throw new ApiError(409, 'CHILD_NOT_SET', 'No child email was provided during onboarding.');
  }

  const childName = parent.childName ?? '';
  const childEmail = parent.childEmail;

  const [childUser] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${childEmail}`)
    .limit(1);

  if (!childUser) {
    return { status: 'pending', childName, childEmail, child: null, subjects: [], tutors: [] };
  }

  const [childProfile] = await db.select({
    role: profiles.role,
    schoolId: profiles.schoolId,
    onboardingCompleted: profiles.onboardingCompleted,
    subjectId: onboardingProfiles.subjectId,
  })
    .from(profiles)
    .leftJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
    .where(eq(profiles.userId, childUser.id))
    .limit(1);

  if (!childProfile || childProfile.role !== 'student' || !childProfile.onboardingCompleted) {
    // The email matches an account, but it isn't a fully onboarded student -
    // from the parent's side this looks the same as "not joined yet".
    return { status: 'pending', childName, childEmail, child: null, subjects: [], tutors: [] };
  }

  const [state, tutorRows] = await Promise.all([
    getStudyStateForUser(childUser.id),
    childProfile.subjectId
      ? db.select({
        id: profiles.userId,
        name: users.name,
        role: profiles.role,
      })
        .from(profiles)
        .innerJoin(users, eq(users.id, profiles.userId))
        .innerJoin(onboardingProfiles, eq(onboardingProfiles.userId, profiles.userId))
        .where(and(
          inArray(profiles.role, ['teacher', 'tutor']),
          eq(profiles.schoolId, childProfile.schoolId),
          eq(onboardingProfiles.subjectId, childProfile.subjectId),
        ))
        .limit(3)
      : Promise.resolve([]),
  ]);

  const subjectNameById = new Map(state.subjects.map((subject) => [subject.id, subject.name]));

  return {
    status: 'linked',
    childName,
    childEmail,
    child: { id: childUser.id, name: childUser.name, email: childUser.email },
    subjects: state.subjects,
    tutors: tutorRows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role as 'teacher' | 'tutor',
      subjectName: childProfile.subjectId ? subjectNameById.get(childProfile.subjectId) ?? null : null,
    })),
  };
}
