import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { schools, subjects, topics } from '../../../../database/schema/catalog.js';
import { discussionRooms, discussionUtterances } from '../../../../database/schema/discussion.js';
import { profiles, quizAttempts, userTopicModeProgress } from '../../../../database/schema/learning.js';
import { notifications } from '../../../../database/schema/notifications.js';
import { squadQuizRoomCompletions, squadQuizRooms } from '../../../../database/schema/squad-quiz.js';
import {
  studySquadInvitations,
  studySquadMembers,
  studySquadStreakRestores,
  studySquads,
} from '../../../../database/schema/study-squads.js';
import { ApiError } from '../errors.js';
import { sendSquadInvitationEmail, SquadEmailError } from './squad-email.js';
import { buildNotificationValues } from './notifications.js';
import { calculateConceptMemory } from '../lib/knowledge-model.js';
import {
  calculateMemberStreak,
  calculateStudySquadStreak,
  toSingaporeDateKey,
} from '../lib/study-squad-streak.js';

const MAX_SQUAD_MEMBERS = 5;
const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export type StudySquadResponse = {
  squad: null | {
    id: string;
    name: string;
    role: 'owner' | 'member';
    members: Array<{
      id: string;
      name: string;
      image: string | null;
      role: 'owner' | 'member';
      joinedAt: Date;
      streakDays: number;
      overallMemoryScore: number | null;
      subjects: Array<{
        id: string;
        name: string;
        score: number;
        topics: Array<{ id: string; name: string; score: number }>;
      }>;
    }>;
    pendingInvitations: Array<{
      id: string;
      email: string;
      userId: string | null;
      name: string | null;
      deliveryStatus: 'pending' | 'sent' | 'failed' | 'in_app';
      expiresAt: Date;
      createdAt: Date;
    }>;
    streak: {
      currentDays: number;
      activeToday: boolean;
      restoresUsedThisMonth: number;
      restoresLimit: number;
      canRestore: boolean;
      restoreDate: string | null;
    };
    createdAt: Date;
  };
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function findMembership(userId: string) {
  const [row] = await db.select({
    squadId: studySquadMembers.squadId,
    role: studySquadMembers.role,
    squadName: studySquads.name,
    ownerUserId: studySquads.ownerUserId,
    createdAt: studySquads.createdAt,
  })
    .from(studySquadMembers)
    .innerJoin(studySquads, eq(studySquads.id, studySquadMembers.squadId))
    .where(eq(studySquadMembers.userId, userId))
    .limit(1);
  return row ?? null;
}

async function loadSchoolActor(userId: string) {
  const [actor] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: profiles.role,
    schoolId: profiles.schoolId,
    schoolName: schools.name,
    onboardingCompleted: profiles.onboardingCompleted,
  })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(schools, eq(schools.id, profiles.schoolId))
    .where(eq(users.id, userId))
    .limit(1);

  if (!actor?.onboardingCompleted || !['student', 'teacher'].includes(actor.role)) {
    throw new ApiError(409, 'ONBOARDING_REQUIRED', 'Complete onboarding before using the school directory.');
  }
  return { ...actor, role: actor.role as 'student' | 'teacher' };
}

export async function getSchoolDirectory(userId: string) {
  const [actor, membership] = await Promise.all([
    loadSchoolActor(userId),
    findMembership(userId),
  ]);
  if (membership) {
    const now = new Date();
    await db.update(studySquadInvitations).set({ status: 'expired', updatedAt: now }).where(and(
      eq(studySquadInvitations.squadId, membership.squadId),
      eq(studySquadInvitations.status, 'pending'),
      lt(studySquadInvitations.expiresAt, now),
    ));
  }
  const people = await db.select({
    id: users.id,
    name: users.name,
    image: users.image,
    role: profiles.role,
    squadId: studySquadMembers.squadId,
  })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(studySquadMembers, eq(studySquadMembers.userId, users.id))
    .where(and(
      eq(profiles.schoolId, actor.schoolId),
      eq(profiles.onboardingCompleted, true),
      ne(users.id, userId),
    ))
    .orderBy(asc(users.name), asc(users.id));

  const pendingInvitations = membership
    ? await db.select({ userId: studySquadInvitations.invitedUserId })
      .from(studySquadInvitations)
      .where(and(
        eq(studySquadInvitations.squadId, membership.squadId),
        eq(studySquadInvitations.status, 'pending'),
      ))
    : [];
  const pendingUserIds = new Set(pendingInvitations
    .map((invitation) => invitation.userId)
    .filter((candidateId): candidateId is string => Boolean(candidateId)));

  return {
    school: { id: actor.schoolId, name: actor.schoolName },
    people: people.flatMap((person) => {
      if (person.role !== 'student' && person.role !== 'teacher') return [];
      const status = person.role === 'teacher'
        ? 'teacher'
        : person.squadId === membership?.squadId
          ? 'member'
          : person.squadId
            ? 'in_other_squad'
            : pendingUserIds.has(person.id)
              ? 'invited'
              : 'available';
      return [{
        id: person.id,
        name: person.name,
        image: person.image,
        role: person.role,
        status,
        canInvite: membership?.role === 'owner' && status === 'available',
      }];
    }),
  };
}

export async function getStudySquad(userId: string): Promise<StudySquadResponse> {
  const membership = await findMembership(userId);
  if (!membership) return { squad: null };

  const now = new Date();
  await db.update(studySquadInvitations).set({ status: 'expired', updatedAt: now }).where(and(
    eq(studySquadInvitations.squadId, membership.squadId),
    eq(studySquadInvitations.status, 'pending'),
    lt(studySquadInvitations.expiresAt, now),
  ));

  const [members, invitationRows] = await Promise.all([
    db.select({
      id: users.id,
      name: users.name,
      image: users.image,
      role: studySquadMembers.role,
      joinedAt: studySquadMembers.joinedAt,
    })
      .from(studySquadMembers)
      .innerJoin(users, eq(users.id, studySquadMembers.userId))
      .where(eq(studySquadMembers.squadId, membership.squadId))
      .orderBy(asc(studySquadMembers.joinedAt)),
    membership.role === 'owner'
      ? db.select({
          id: studySquadInvitations.id,
          email: studySquadInvitations.invitedEmail,
          userId: studySquadInvitations.invitedUserId,
          deliveryStatus: studySquadInvitations.deliveryStatus,
          expiresAt: studySquadInvitations.expiresAt,
          createdAt: studySquadInvitations.createdAt,
        })
          .from(studySquadInvitations)
          .where(and(
            eq(studySquadInvitations.squadId, membership.squadId),
            eq(studySquadInvitations.status, 'pending'),
          ))
          .orderBy(asc(studySquadInvitations.createdAt))
      : Promise.resolve([]),
  ]);
  const invitedUserIds = invitationRows
    .map((invitation) => invitation.userId)
    .filter((userId): userId is string => Boolean(userId));
  const invitedUsers = invitedUserIds.length === 0
    ? []
    : await db.select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, invitedUserIds));
  const invitedUserNames = new Map(invitedUsers.map((user) => [user.id, user.name]));
  const invitations = invitationRows.map((invitation) => ({
    ...invitation,
    name: invitation.userId ? invitedUserNames.get(invitation.userId) ?? null : null,
  }));
  const memberIds = members.map((member) => member.id);
  const [progressRows, activityRows, restoreRows, rescueCompletionRows, revisionCompletionRows] = await Promise.all([
    memberIds.length === 0
      ? Promise.resolve([])
      : db.select({
        userId: userTopicModeProgress.userId,
        subjectId: subjects.id,
        subjectName: subjects.name,
        topicId: topics.id,
        topicName: topics.name,
        mode: userTopicModeProgress.assessmentMode,
        mastery: userTopicModeProgress.mastery,
        lastUpdatedAt: userTopicModeProgress.lastUpdatedAt,
      })
        .from(userTopicModeProgress)
        .innerJoin(topics, eq(topics.id, userTopicModeProgress.topicId))
        .innerJoin(subjects, eq(subjects.id, topics.subjectId))
        .where(inArray(userTopicModeProgress.userId, memberIds)),
    memberIds.length === 0
      ? Promise.resolve([])
      : db.select({
          userId: quizAttempts.userId,
          completedAt: quizAttempts.completedAt,
        })
          .from(quizAttempts)
          .where(and(
            inArray(quizAttempts.userId, memberIds),
            eq(quizAttempts.status, 'completed'),
            inArray(quizAttempts.quizMode, ['mcq', 'essay']),
            isNotNull(quizAttempts.completedAt),
          )),
    db.select({
      restoredDate: studySquadStreakRestores.restoredDate,
      restoredAt: studySquadStreakRestores.restoredAt,
    })
      .from(studySquadStreakRestores)
      .where(eq(studySquadStreakRestores.squadId, membership.squadId)),
    db.select({ completedAt: squadQuizRoomCompletions.completedAt })
      .from(squadQuizRoomCompletions)
      .innerJoin(squadQuizRooms, eq(squadQuizRooms.id, squadQuizRoomCompletions.roomId))
      .where(eq(squadQuizRooms.squadId, membership.squadId)),
    db.select({ completedAt: discussionRooms.endedAt })
      .from(discussionRooms)
      .where(and(
        eq(discussionRooms.squadId, membership.squadId),
        eq(discussionRooms.status, 'ended'),
        isNotNull(discussionRooms.endedAt),
        sql`exists (select 1 from ${discussionUtterances} where ${discussionUtterances.roomId} = ${discussionRooms.id})`,
      )),
  ]);

  const activityDatesByUser = new Map<string, Set<string>>();
  const memberJoinedAt = new Map(members.map((member) => [member.id, member.joinedAt]));
  for (const activity of activityRows) {
    if (!activity.completedAt) continue;
    const joinedAt = memberJoinedAt.get(activity.userId);
    if (!joinedAt || activity.completedAt < joinedAt) continue;
    const dates = activityDatesByUser.get(activity.userId) ?? new Set<string>();
    dates.add(toSingaporeDateKey(activity.completedAt));
    activityDatesByUser.set(activity.userId, dates);
  }
  const squadActivityDates = new Set(
    [...activityDatesByUser.values()].flatMap((dates) => [...dates]),
  );
  for (const completion of rescueCompletionRows) {
    squadActivityDates.add(toSingaporeDateKey(completion.completedAt));
  }
  for (const completion of revisionCompletionRows) {
    if (completion.completedAt) squadActivityDates.add(toSingaporeDateKey(completion.completedAt));
  }
  const streakCalculatedAt = new Date();
  const streak = calculateStudySquadStreak({
    activityDates: squadActivityDates,
    restores: restoreRows,
    squadCreatedAt: membership.createdAt,
    now: streakCalculatedAt,
  });

  const topicProgress = new Map<string, {
    userId: string;
    subjectId: string;
    subjectName: string;
    topicId: string;
    topicName: string;
    modes: Array<{ mode: 'mcq' | 'essay'; mastery: number; lastUpdatedAt: Date }>;
  }>();
  for (const progress of progressRows) {
    const key = `${progress.userId}:${progress.topicId}`;
    const group = topicProgress.get(key) ?? {
      userId: progress.userId,
      subjectId: progress.subjectId,
      subjectName: progress.subjectName,
      topicId: progress.topicId,
      topicName: progress.topicName,
      modes: [],
    };
    group.modes.push({
      mode: progress.mode,
      mastery: progress.mastery,
      lastUpdatedAt: progress.lastUpdatedAt,
    });
    topicProgress.set(key, group);
  }

  const subjectsByUser = new Map<string, Map<string, {
    id: string;
    name: string;
    topics: Array<{ id: string; name: string; score: number }>;
  }>>();
  const calculatedAt = new Date();
  for (const group of topicProgress.values()) {
    const score = calculateConceptMemory(group.modes, calculatedAt).conceptMemoryScore;
    if (score === null) continue;
    const userSubjects = subjectsByUser.get(group.userId) ?? new Map();
    const subject = userSubjects.get(group.subjectId) ?? {
      id: group.subjectId,
      name: group.subjectName,
      topics: [],
    };
    subject.topics.push({ id: group.topicId, name: group.topicName, score: Math.round(score) });
    userSubjects.set(group.subjectId, subject);
    subjectsByUser.set(group.userId, userSubjects);
  }

  const membersWithProgress = members.map((member) => {
    const memberSubjects = [...(subjectsByUser.get(member.id)?.values() ?? [])]
      .map((subject) => ({
        ...subject,
        score: Math.round(subject.topics.reduce((sum, topic) => sum + topic.score, 0) / subject.topics.length),
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
    const overallMemoryScore = memberSubjects.length === 0
      ? null
      : Math.round(memberSubjects.reduce((sum, subject) => sum + subject.score, 0) / memberSubjects.length);
    return {
      ...member,
      streakDays: calculateMemberStreak({
        activityDates: activityDatesByUser.get(member.id) ?? [],
        joinedAt: member.joinedAt,
        now: streakCalculatedAt,
      }),
      overallMemoryScore,
      subjects: memberSubjects,
    };
  });

  return {
    squad: {
      id: membership.squadId,
      name: membership.squadName,
      role: membership.role,
      members: membersWithProgress,
      pendingInvitations: invitations,
      streak,
      createdAt: membership.createdAt,
    },
  };
}

export async function restoreStudySquadStreak(userId: string, userName: string): Promise<StudySquadResponse> {
  const membership = await findMembership(userId);
  if (!membership) throw new ApiError(404, 'SQUAD_NOT_FOUND', 'Join a study squad before restoring its streak.');

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`study-squad-streak:${membership.squadId}`}))`,
    );
    const memberRows = await transaction.select({
      userId: studySquadMembers.userId,
      joinedAt: studySquadMembers.joinedAt,
    })
      .from(studySquadMembers)
      .where(eq(studySquadMembers.squadId, membership.squadId));
    const memberIds = memberRows.map((member) => member.userId);
    const [activityRows, restoreRows, rescueCompletionRows, revisionCompletionRows] = await Promise.all([
      transaction.select({
        userId: quizAttempts.userId,
        completedAt: quizAttempts.completedAt,
      })
        .from(quizAttempts)
        .where(and(
          inArray(quizAttempts.userId, memberIds),
          eq(quizAttempts.status, 'completed'),
          inArray(quizAttempts.quizMode, ['mcq', 'essay']),
          isNotNull(quizAttempts.completedAt),
        )),
      transaction.select({
        restoredDate: studySquadStreakRestores.restoredDate,
        restoredAt: studySquadStreakRestores.restoredAt,
      })
        .from(studySquadStreakRestores)
        .where(eq(studySquadStreakRestores.squadId, membership.squadId)),
      transaction.select({ completedAt: squadQuizRoomCompletions.completedAt })
        .from(squadQuizRoomCompletions)
        .innerJoin(squadQuizRooms, eq(squadQuizRooms.id, squadQuizRoomCompletions.roomId))
        .where(eq(squadQuizRooms.squadId, membership.squadId)),
      transaction.select({ completedAt: discussionRooms.endedAt })
        .from(discussionRooms)
        .where(and(
          eq(discussionRooms.squadId, membership.squadId),
          eq(discussionRooms.status, 'ended'),
          isNotNull(discussionRooms.endedAt),
          sql`exists (select 1 from ${discussionUtterances} where ${discussionUtterances.roomId} = ${discussionRooms.id})`,
        )),
    ]);
    const joinedAtByUser = new Map(memberRows.map((member) => [member.userId, member.joinedAt]));
    const activityDates = new Set<string>();
    for (const activity of activityRows) {
      if (!activity.completedAt) continue;
      const joinedAt = joinedAtByUser.get(activity.userId);
      if (joinedAt && activity.completedAt >= joinedAt) {
        activityDates.add(toSingaporeDateKey(activity.completedAt));
      }
    }
    for (const completion of rescueCompletionRows) {
      activityDates.add(toSingaporeDateKey(completion.completedAt));
    }
    for (const completion of revisionCompletionRows) {
      if (completion.completedAt) activityDates.add(toSingaporeDateKey(completion.completedAt));
    }
    const restoredAt = new Date();
    const streak = calculateStudySquadStreak({
      activityDates,
      restores: restoreRows,
      squadCreatedAt: membership.createdAt,
      now: restoredAt,
    });
    if (streak.restoresUsedThisMonth >= streak.restoresLimit) {
      throw new ApiError(409, 'STREAK_RESTORE_LIMIT_REACHED', 'Your squad has used all five restores for this month.');
    }
    if (!streak.restoreDate) {
      throw new ApiError(409, 'STREAK_NOT_RESTORABLE', 'There is no broken streak day available to restore yet.');
    }

    const restoreId = randomUUID();
    await transaction.insert(studySquadStreakRestores).values({
      id: restoreId,
      squadId: membership.squadId,
      restoredDate: streak.restoreDate,
      restoredByUserId: userId,
      restoredAt,
    });
    const notificationRecipients = memberIds.filter((memberId) => memberId !== userId);
    if (notificationRecipients.length > 0) {
      await transaction.insert(notifications).values(notificationRecipients.map((recipientUserId) => (
        buildNotificationValues({
          recipientUserId,
          actorUserId: userId,
          channel: 'study_squad',
          type: 'squad_streak_restored',
          title: `${userName} restored your squad streak`,
          body: `${streak.restoreDate} is now protected for ${membership.squadName}.`,
          href: '/study-squad',
          resourceId: membership.squadId,
          dedupeKey: `squad-streak-restored:${restoreId}:${recipientUserId}`,
          createdAt: restoredAt,
        })
      )));
    }
  });

  return getStudySquad(userId);
}

export async function createStudySquad(userId: string, name: string): Promise<StudySquadResponse> {
  const actor = await loadSchoolActor(userId);
  if (actor.role !== 'student') {
    throw new ApiError(403, 'STUDENT_ONLY', 'Only students can create or join a Study Squad.');
  }
  if (await findMembership(userId)) {
    throw new ApiError(409, 'ALREADY_IN_SQUAD', 'You already belong to a study squad.');
  }

  const squadId = randomUUID();
  const now = new Date();
  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(studySquads).values({
        id: squadId,
        name: name.trim(),
        ownerUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(studySquadMembers).values({
        squadId,
        userId,
        role: 'owner',
        joinedAt: now,
      });
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === '23505') {
      throw new ApiError(409, 'ALREADY_IN_SQUAD', 'You already belong to a study squad.');
    }
    throw error;
  }

  return getStudySquad(userId);
}

export async function inviteToStudySquad(
  userId: string,
  inviterName: string,
  inviterEmail: string,
  recipientEmailInput: string,
): Promise<NonNullable<StudySquadResponse['squad']>['pendingInvitations'][number]> {
  const membership = await findMembership(userId);
  if (!membership) throw new ApiError(404, 'SQUAD_NOT_FOUND', 'Create a study squad before inviting friends.');
  if (membership.role !== 'owner') {
    throw new ApiError(403, 'SQUAD_OWNER_ONLY', 'Only the squad owner can send invitations.');
  }

  const recipientEmail = normalizeEmail(recipientEmailInput);
  if (recipientEmail === normalizeEmail(inviterEmail)) {
    throw new ApiError(400, 'CANNOT_INVITE_SELF', 'You are already in this squad.');
  }

  const now = new Date();
  await db.update(studySquadInvitations).set({
    status: 'expired',
    updatedAt: now,
  }).where(and(
    eq(studySquadInvitations.squadId, membership.squadId),
    eq(studySquadInvitations.status, 'pending'),
    lt(studySquadInvitations.expiresAt, now),
  ));

  const [existingMember, existingInvitation, memberCountRows, pendingInvitationCountRows] = await Promise.all([
    db.select({ id: users.id })
      .from(studySquadMembers)
      .innerJoin(users, eq(users.id, studySquadMembers.userId))
      .where(and(
        eq(studySquadMembers.squadId, membership.squadId),
        sql`lower(${users.email}) = ${recipientEmail}`,
      ))
      .limit(1),
    db.select({ id: studySquadInvitations.id })
      .from(studySquadInvitations)
      .where(and(
        eq(studySquadInvitations.squadId, membership.squadId),
        eq(studySquadInvitations.invitedEmail, recipientEmail),
        eq(studySquadInvitations.status, 'pending'),
      ))
      .limit(1),
    db.select({ count: sql<number>`count(*)::int` })
      .from(studySquadMembers)
      .where(eq(studySquadMembers.squadId, membership.squadId)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(studySquadInvitations)
      .where(and(
        eq(studySquadInvitations.squadId, membership.squadId),
        eq(studySquadInvitations.status, 'pending'),
      )),
  ]);

  if (existingMember[0]) throw new ApiError(409, 'ALREADY_IN_SQUAD', 'That person is already in this squad.');
  if (existingInvitation[0]) {
    throw new ApiError(409, 'INVITATION_ALREADY_SENT', 'A pending invitation already exists for that email.');
  }
  const reservedPlaces = (memberCountRows[0]?.count ?? 0) + (pendingInvitationCountRows[0]?.count ?? 0);
  if (reservedPlaces >= MAX_SQUAD_MEMBERS) {
    throw new ApiError(409, 'SQUAD_FULL', `A study squad can have up to ${MAX_SQUAD_MEMBERS} members.`);
  }

  const invitationId = randomUUID();
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
  const [invitation] = await db.insert(studySquadInvitations).values({
    id: invitationId,
    squadId: membership.squadId,
    invitedEmail: recipientEmail,
    invitedByUserId: userId,
    tokenHash: hashInvitationToken(token),
    status: 'pending',
    deliveryStatus: 'pending',
    expiresAt,
    createdAt: now,
    updatedAt: now,
  }).returning({
    id: studySquadInvitations.id,
    email: studySquadInvitations.invitedEmail,
    userId: studySquadInvitations.invitedUserId,
    deliveryStatus: studySquadInvitations.deliveryStatus,
    expiresAt: studySquadInvitations.expiresAt,
    createdAt: studySquadInvitations.createdAt,
  });

  if (!invitation) throw new Error('Study squad invitation was not created.');

  try {
    const delivery = await sendSquadInvitationEmail({
      invitationId,
      recipientEmail,
      inviterName,
      squadName: membership.squadName,
      token,
    });
    await db.update(studySquadInvitations).set({
      deliveryStatus: 'sent',
      emailMessageId: delivery.messageId,
      updatedAt: new Date(),
    }).where(eq(studySquadInvitations.id, invitationId));
  } catch (error) {
    await db.update(studySquadInvitations).set({
      status: 'revoked',
      deliveryStatus: 'failed',
      updatedAt: new Date(),
    }).where(eq(studySquadInvitations.id, invitationId));
    if (error instanceof SquadEmailError && error.reason === 'configuration') {
      throw new ApiError(503, 'SQUAD_EMAIL_NOT_CONFIGURED', 'Squad invitation email is not configured yet.');
    }
    throw new ApiError(502, 'SQUAD_EMAIL_DELIVERY_FAILED', 'The invitation email could not be delivered. Try again.');
  }

  return { ...invitation, name: null, deliveryStatus: 'sent' };
}

export async function inviteSchoolUserToStudySquad(userId: string, targetUserId: string) {
  const [membership, actor] = await Promise.all([
    findMembership(userId),
    loadSchoolActor(userId),
  ]);
  if (!membership) throw new ApiError(404, 'SQUAD_NOT_FOUND', 'Create a study squad before inviting people.');
  if (membership.role !== 'owner') {
    throw new ApiError(403, 'SQUAD_OWNER_ONLY', 'Only the squad owner can send invitations.');
  }
  if (targetUserId === userId) throw new ApiError(400, 'CANNOT_INVITE_SELF', 'You are already in this squad.');

  const [target] = await db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: profiles.role,
    schoolId: profiles.schoolId,
    onboardingCompleted: profiles.onboardingCompleted,
  })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .where(and(
      eq(users.id, targetUserId),
      eq(profiles.schoolId, actor.schoolId),
      eq(profiles.onboardingCompleted, true),
    ))
    .limit(1);
  if (!target) throw new ApiError(404, 'SCHOOL_MEMBER_NOT_FOUND', 'That person is not available in your school directory.');
  if (target.role !== 'student') {
    throw new ApiError(400, 'STUDENT_ONLY', 'Teachers can be contacted through Ask Teacher but cannot join a Study Squad.');
  }

  const now = new Date();
  await db.update(studySquadInvitations).set({ status: 'expired', updatedAt: now }).where(and(
    eq(studySquadInvitations.squadId, membership.squadId),
    eq(studySquadInvitations.status, 'pending'),
    lt(studySquadInvitations.expiresAt, now),
  ));

  const [targetMembership, existingInvitation, memberCountRows, pendingInvitationCountRows] = await Promise.all([
    findMembership(target.id),
    db.select({ id: studySquadInvitations.id })
      .from(studySquadInvitations)
      .where(and(
        eq(studySquadInvitations.squadId, membership.squadId),
        eq(studySquadInvitations.invitedUserId, target.id),
        eq(studySquadInvitations.status, 'pending'),
      ))
      .limit(1),
    db.select({ count: sql<number>`count(*)::int` })
      .from(studySquadMembers)
      .where(eq(studySquadMembers.squadId, membership.squadId)),
    db.select({ count: sql<number>`count(*)::int` })
      .from(studySquadInvitations)
      .where(and(
        eq(studySquadInvitations.squadId, membership.squadId),
        eq(studySquadInvitations.status, 'pending'),
      )),
  ]);
  if (targetMembership) {
    throw new ApiError(409, 'ALREADY_IN_SQUAD', targetMembership.squadId === membership.squadId
      ? 'That person is already in your squad.'
      : 'That person already belongs to another squad.');
  }
  if (existingInvitation[0]) {
    throw new ApiError(409, 'INVITATION_ALREADY_SENT', 'That person already has a pending invitation from this squad.');
  }
  const reservedPlaces = (memberCountRows[0]?.count ?? 0) + (pendingInvitationCountRows[0]?.count ?? 0);
  if (reservedPlaces >= MAX_SQUAD_MEMBERS) {
    throw new ApiError(409, 'SQUAD_FULL', `A study squad can have up to ${MAX_SQUAD_MEMBERS} members.`);
  }

  const invitationId = randomUUID();
  const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_MS);
  try {
    await db.transaction(async (transaction) => {
      await transaction.insert(studySquadInvitations).values({
        id: invitationId,
        squadId: membership.squadId,
        invitedEmail: target.email.toLowerCase(),
        invitedUserId: target.id,
        invitedByUserId: userId,
        tokenHash: null,
        status: 'pending',
        deliveryStatus: 'in_app',
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
      await transaction.insert(notifications).values(buildNotificationValues({
        recipientUserId: target.id,
        actorUserId: userId,
        channel: 'study_squad',
        type: 'squad_invitation',
        title: `${actor.name} invited you to ${membership.squadName}`,
        body: 'Open the invitation to accept or decline it.',
        href: '/notifications',
        resourceId: invitationId,
        dedupeKey: `squad-invitation:${invitationId}`,
        createdAt: now,
      }));
    });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
    if (code === '23505') {
      throw new ApiError(409, 'INVITATION_ALREADY_SENT', 'That person already has a pending invitation from this squad.');
    }
    throw error;
  }

  return {
    id: invitationId,
    email: target.email.toLowerCase(),
    userId: target.id,
    name: target.name,
    deliveryStatus: 'in_app' as const,
    expiresAt,
    createdAt: now,
  };
}

async function loadInvitation(token: string) {
  const [invitation] = await db.select({
    id: studySquadInvitations.id,
    squadId: studySquadInvitations.squadId,
    squadName: studySquads.name,
    invitedEmail: studySquadInvitations.invitedEmail,
    invitedUserId: studySquadInvitations.invitedUserId,
    inviterName: users.name,
    ownerUserId: studySquads.ownerUserId,
    status: studySquadInvitations.status,
    expiresAt: studySquadInvitations.expiresAt,
    acceptedByUserId: studySquadInvitations.acceptedByUserId,
  })
    .from(studySquadInvitations)
    .innerJoin(studySquads, eq(studySquads.id, studySquadInvitations.squadId))
    .leftJoin(users, eq(users.id, studySquadInvitations.invitedByUserId))
    .where(eq(studySquadInvitations.tokenHash, hashInvitationToken(token)))
    .limit(1);
  return invitation ?? null;
}

async function loadInvitationById(invitationId: string) {
  const [invitation] = await db.select({
    id: studySquadInvitations.id,
    squadId: studySquadInvitations.squadId,
    squadName: studySquads.name,
    invitedEmail: studySquadInvitations.invitedEmail,
    invitedUserId: studySquadInvitations.invitedUserId,
    inviterName: users.name,
    ownerUserId: studySquads.ownerUserId,
    status: studySquadInvitations.status,
    expiresAt: studySquadInvitations.expiresAt,
    acceptedByUserId: studySquadInvitations.acceptedByUserId,
  })
    .from(studySquadInvitations)
    .innerJoin(studySquads, eq(studySquads.id, studySquadInvitations.squadId))
    .leftJoin(users, eq(users.id, studySquadInvitations.invitedByUserId))
    .where(eq(studySquadInvitations.id, invitationId))
    .limit(1);
  return invitation ?? null;
}

export async function getStudySquadInvitation(token: string) {
  const invitation = await loadInvitation(token);
  if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'This squad invitation is not valid.');

  if (invitation.status === 'pending' && invitation.expiresAt <= new Date()) {
    await db.update(studySquadInvitations).set({ status: 'expired', updatedAt: new Date() })
      .where(eq(studySquadInvitations.id, invitation.id));
    throw new ApiError(410, 'INVITATION_EXPIRED', 'This squad invitation has expired.');
  }
  if (invitation.status !== 'pending') {
    throw new ApiError(410, 'INVITATION_UNAVAILABLE', 'This squad invitation is no longer available.');
  }

  return {
    squadName: invitation.squadName,
    inviterName: invitation.inviterName ?? 'A friend',
    expiresAt: invitation.expiresAt,
  };
}

type LoadedInvitation = NonNullable<Awaited<ReturnType<typeof loadInvitation>>>;

async function acceptLoadedInvitation(
  userId: string,
  userName: string,
  invitation: LoadedInvitation,
) {
  const [actor, owner] = await Promise.all([
    loadSchoolActor(userId),
    loadSchoolActor(invitation.ownerUserId),
  ]);
  if (actor.role !== 'student') {
    throw new ApiError(403, 'STUDENT_ONLY', 'Only students can join a Study Squad.');
  }
  if (actor.schoolId !== owner.schoolId) {
    throw new ApiError(403, 'SCHOOL_MISMATCH', 'Study Squad invitations are limited to students at the same school.');
  }
  if (invitation.status === 'accepted' && invitation.acceptedByUserId === userId) {
    return getStudySquad(userId);
  }
  if (invitation.status !== 'pending') {
    throw new ApiError(410, 'INVITATION_UNAVAILABLE', 'This squad invitation is no longer available.');
  }
  if (invitation.expiresAt <= new Date()) {
    await db.update(studySquadInvitations).set({ status: 'expired', updatedAt: new Date() })
      .where(eq(studySquadInvitations.id, invitation.id));
    throw new ApiError(410, 'INVITATION_EXPIRED', 'This squad invitation has expired.');
  }

  const existingMembership = await findMembership(userId);
  if (existingMembership && existingMembership.squadId !== invitation.squadId) {
    throw new ApiError(409, 'ALREADY_IN_SQUAD', 'Leave your current squad before joining another one.');
  }

  await db.transaction(async (transaction) => {
    const [memberCount] = await transaction.select({ count: sql<number>`count(*)::int` })
      .from(studySquadMembers)
      .where(eq(studySquadMembers.squadId, invitation.squadId));
    if ((memberCount?.count ?? 0) >= MAX_SQUAD_MEMBERS && !existingMembership) {
      throw new ApiError(409, 'SQUAD_FULL', 'This study squad is already full.');
    }

    const acceptedAt = new Date();
    const [acceptedInvitation] = await transaction.update(studySquadInvitations).set({
      status: 'accepted',
      acceptedByUserId: userId,
      acceptedAt,
      updatedAt: acceptedAt,
    }).where(and(
      eq(studySquadInvitations.id, invitation.id),
      eq(studySquadInvitations.status, 'pending'),
    )).returning({ id: studySquadInvitations.id });
    if (!acceptedInvitation) {
      throw new ApiError(409, 'INVITATION_ALREADY_USED', 'This squad invitation has already been used.');
    }

    if (!existingMembership) {
      const [createdMembership] = await transaction.insert(studySquadMembers).values({
        squadId: invitation.squadId,
        userId,
        role: 'member',
        joinedAt: acceptedAt,
      }).onConflictDoNothing().returning({ userId: studySquadMembers.userId });
      if (!createdMembership) {
        throw new ApiError(409, 'ALREADY_IN_SQUAD', 'You already belong to another study squad.');
      }
    }

    await transaction.update(notifications).set({ readAt: acceptedAt }).where(and(
      eq(notifications.recipientUserId, userId),
      eq(notifications.type, 'squad_invitation'),
    ));
    await transaction.update(studySquadInvitations).set({
      status: 'revoked',
      updatedAt: acceptedAt,
    }).where(and(
      eq(studySquadInvitations.invitedUserId, userId),
      eq(studySquadInvitations.status, 'pending'),
      ne(studySquadInvitations.id, invitation.id),
    ));

    if (invitation.ownerUserId !== userId) {
      await transaction.insert(notifications).values(buildNotificationValues({
        recipientUserId: invitation.ownerUserId,
        actorUserId: userId,
        channel: 'study_squad',
        type: 'squad_invitation_accepted',
        title: `${userName} joined ${invitation.squadName}`,
        body: 'Your new squad member can now participate in Study Squad activities.',
        href: '/study-squad',
        resourceId: invitation.squadId,
        dedupeKey: `squad-invitation-accepted:${invitation.id}`,
        createdAt: acceptedAt,
      })).onConflictDoNothing();
    }
  });

  return getStudySquad(userId);
}

export async function acceptStudySquadInvitation(
  userId: string,
  userName: string,
  userEmail: string,
  token: string,
) {
  const invitation = await loadInvitation(token);
  if (!invitation) throw new ApiError(404, 'INVITATION_NOT_FOUND', 'This squad invitation is not valid.');
  if (normalizeEmail(userEmail) !== invitation.invitedEmail) {
    throw new ApiError(403, 'INVITATION_EMAIL_MISMATCH', 'Sign in with the email address that received this invitation.');
  }
  return acceptLoadedInvitation(userId, userName, invitation);
}

export async function acceptInAppStudySquadInvitation(
  userId: string,
  userName: string,
  invitationId: string,
) {
  const invitation = await loadInvitationById(invitationId);
  if (!invitation || invitation.invitedUserId !== userId) {
    throw new ApiError(404, 'INVITATION_NOT_FOUND', 'This squad invitation was not found.');
  }
  return acceptLoadedInvitation(userId, userName, invitation);
}

export async function declineInAppStudySquadInvitation(
  userId: string,
  userName: string,
  invitationId: string,
) {
  const invitation = await loadInvitationById(invitationId);
  if (!invitation || invitation.invitedUserId !== userId) {
    throw new ApiError(404, 'INVITATION_NOT_FOUND', 'This squad invitation was not found.');
  }
  if (invitation.status !== 'pending') {
    throw new ApiError(410, 'INVITATION_UNAVAILABLE', 'This squad invitation is no longer available.');
  }

  const declinedAt = new Date();
  await db.transaction(async (transaction) => {
    const [declined] = await transaction.update(studySquadInvitations).set({
      status: 'revoked',
      updatedAt: declinedAt,
    }).where(and(
      eq(studySquadInvitations.id, invitation.id),
      eq(studySquadInvitations.status, 'pending'),
    )).returning({ id: studySquadInvitations.id });
    if (!declined) throw new ApiError(409, 'INVITATION_ALREADY_USED', 'This invitation was already handled.');

    await transaction.update(notifications).set({ readAt: declinedAt }).where(and(
      eq(notifications.recipientUserId, userId),
      eq(notifications.type, 'squad_invitation'),
      eq(notifications.resourceId, invitation.id),
    ));
    await transaction.insert(notifications).values(buildNotificationValues({
      recipientUserId: invitation.ownerUserId,
      actorUserId: userId,
      channel: 'study_squad',
      type: 'squad_invitation_declined',
      title: `${userName} declined the squad invitation`,
      body: `The invitation to ${invitation.squadName} was declined.`,
      href: '/study-squad',
      resourceId: invitation.squadId,
      dedupeKey: `squad-invitation-declined:${invitation.id}`,
      createdAt: declinedAt,
    })).onConflictDoNothing();
  });

  return { invitationId, status: 'declined' as const };
}
