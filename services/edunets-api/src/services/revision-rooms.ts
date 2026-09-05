import { randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import {
  discussionParticipants,
  discussionRooms,
  discussionUtterances,
} from '../../../../database/schema/discussion.js';
import { learningWork } from '../../../../database/schema/learning-work.js';
import { notifications } from '../../../../database/schema/notifications.js';
import { studySquadMembers, studySquads } from '../../../../database/schema/study-squads.js';
import { ApiError } from '../errors.js';
import { buildNotificationValues } from './notifications.js';

const ONLINE_WINDOW_MS = 20_000;

async function loadMembership(userId: string) {
  const [membership] = await db.select({
    squadId: studySquadMembers.squadId,
    squadName: studySquads.name,
  })
    .from(studySquadMembers)
    .innerJoin(studySquads, eq(studySquads.id, studySquadMembers.squadId))
    .where(eq(studySquadMembers.userId, userId))
    .limit(1);
  return membership ?? null;
}

async function loadRoom(roomId: string) {
  const [room] = await db.select({
    id: discussionRooms.id,
    squadId: discussionRooms.squadId,
    squadName: studySquads.name,
    hostUserId: discussionRooms.hostUserId,
    hostName: users.name,
    topicId: discussionRooms.topicId,
    topicName: topics.name,
    subjectId: discussionRooms.subjectId,
    subjectName: subjects.name,
    status: discussionRooms.status,
    durationSeconds: discussionRooms.durationSeconds,
    joinCode: discussionRooms.joinCode,
    createdAt: discussionRooms.createdAt,
    startedAt: discussionRooms.startedAt,
    endedAt: discussionRooms.endedAt,
  })
    .from(discussionRooms)
    .innerJoin(users, eq(users.id, discussionRooms.hostUserId))
    .innerJoin(topics, eq(topics.id, discussionRooms.topicId))
    .innerJoin(subjects, eq(subjects.id, discussionRooms.subjectId))
    .leftJoin(studySquads, eq(studySquads.id, discussionRooms.squadId))
    .where(eq(discussionRooms.id, roomId))
    .limit(1);
  return room ?? null;
}

async function requireRoomAccess(userId: string, roomId: string) {
  const [membership, room] = await Promise.all([loadMembership(userId), loadRoom(roomId)]);
  if (!room) throw new ApiError(404, 'REVISION_ROOM_NOT_FOUND', 'This Revision Room was not found.');
  if (!room.squadId || !membership || membership.squadId !== room.squadId) {
    throw new ApiError(403, 'REVISION_ROOM_FORBIDDEN', 'Only members of this Study Squad can open the room.');
  }
  return { membership, room };
}

export async function getRevisionRoom(userId: string, roomId: string) {
  const { room } = await requireRoomAccess(userId, roomId);
  const now = new Date();
  const [participantRows, utteranceRows] = await Promise.all([
    db.select({
      userId: discussionParticipants.userId,
      displayName: users.name,
      image: users.image,
      status: discussionParticipants.status,
      speakingMs: discussionParticipants.speakingMs,
      joinedAt: discussionParticipants.joinedAt,
      leftAt: discussionParticipants.leftAt,
      lastSeenAt: discussionParticipants.lastSeenAt,
    })
      .from(discussionParticipants)
      .innerJoin(users, eq(users.id, discussionParticipants.userId))
      .where(eq(discussionParticipants.roomId, roomId))
      .orderBy(asc(discussionParticipants.joinedAt), asc(discussionParticipants.userId)),
    db.select({
      id: discussionUtterances.id,
      userId: discussionUtterances.userId,
      displayName: users.name,
      text: discussionUtterances.text,
      locale: discussionUtterances.locale,
      provider: discussionUtterances.provider,
      spokenAt: discussionUtterances.spokenAt,
      createdAt: discussionUtterances.createdAt,
    })
      .from(discussionUtterances)
      .innerJoin(users, eq(users.id, discussionUtterances.userId))
      .where(eq(discussionUtterances.roomId, roomId))
      .orderBy(asc(discussionUtterances.spokenAt), asc(discussionUtterances.id))
      .limit(200),
  ]);

  const onlineCutoff = now.getTime() - ONLINE_WINDOW_MS;
  const currentParticipant = participantRows.find((participant) => participant.userId === userId) ?? null;
  return {
    room: {
      ...room,
      serverNow: now,
      canManage: room.hostUserId === userId,
      hasJoined: currentParticipant?.status === 'joined',
      canJoin: room.status !== 'ended' && currentParticipant?.status !== 'left',
      participants: participantRows.map((participant) => ({
        ...participant,
        presence: participant.status === 'invited'
          ? 'invited'
          : participant.status === 'left'
            ? 'left'
            : room.status === 'ended'
              ? 'finished'
              : participant.lastSeenAt.getTime() >= onlineCutoff
                ? 'online'
                : 'away',
      })),
      utterances: utteranceRows,
    },
  };
}

async function loadInvitedMembers(squadId: string, hostUserId: string, invitedUserIds: string[]) {
  const invitedIds = [...new Set(invitedUserIds)].filter((candidate) => candidate !== hostUserId);
  const invitedMembers = invitedIds.length === 0 ? [] : await db.select({
    userId: studySquadMembers.userId,
    name: users.name,
  })
    .from(studySquadMembers)
    .innerJoin(users, eq(users.id, studySquadMembers.userId))
    .where(and(
      eq(studySquadMembers.squadId, squadId),
      inArray(studySquadMembers.userId, invitedIds),
    ));
  if (invitedMembers.length !== invitedIds.length) {
    throw new ApiError(400, 'INVALID_REVISION_ROOM_INVITEE', 'Every invited participant must belong to your Study Squad.');
  }
  return invitedMembers;
}

export async function createRevisionRoom(input: {
  userId: string;
  userName: string;
  topicId: string;
  invitedUserIds: string[];
}) {
  const membership = await loadMembership(input.userId);
  if (!membership) throw new ApiError(404, 'SQUAD_NOT_FOUND', 'Join a Study Squad before starting a Revision Room.');
  const [topic] = await db.select({ id: topics.id, subjectId: topics.subjectId })
    .from(topics)
    .where(eq(topics.id, input.topicId))
    .limit(1);
  if (!topic) throw new ApiError(404, 'TOPIC_NOT_FOUND', 'That revision topic was not found.');
  const invitedMembers = await loadInvitedMembers(membership.squadId, input.userId, input.invitedUserIds);
  const roomId = randomUUID();
  const joinCode = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const now = new Date();

  await db.transaction(async (transaction) => {
    await transaction.insert(discussionRooms).values({
      id: roomId,
      squadId: membership.squadId,
      subjectId: topic.subjectId,
      topicId: input.topicId,
      hostUserId: input.userId,
      status: 'lobby',
      durationSeconds: 180,
      joinCode,
      createdAt: now,
    });
    await transaction.insert(discussionParticipants).values([
      {
        roomId,
        userId: input.userId,
        status: 'joined',
        joinedAt: now,
        lastSeenAt: now,
      },
      ...invitedMembers.map((member) => ({
        roomId,
        userId: member.userId,
        status: 'invited' as const,
        joinedAt: now,
        lastSeenAt: now,
      })),
    ]);
    if (invitedMembers.length > 0) {
      await transaction.insert(notifications).values(invitedMembers.map((member) => buildNotificationValues({
        recipientUserId: member.userId,
        actorUserId: input.userId,
        channel: 'study_squad',
        type: 'revision_room_invitation',
        title: `${input.userName} invited you to a Revision Room`,
        body: `Join ${membership.squadName} and explain this topic together.`,
        href: `/revision-room?roomId=${encodeURIComponent(roomId)}`,
        resourceId: roomId,
        dedupeKey: `revision-room-invitation:${roomId}:${member.userId}`,
        createdAt: now,
      }))).onConflictDoNothing();
    }
  });
  return getRevisionRoom(input.userId, roomId);
}

export async function joinRevisionRoom(userId: string, roomId: string) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.status === 'ended') throw new ApiError(409, 'REVISION_ROOM_ENDED', 'This Revision Room has ended.');
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.insert(discussionParticipants).values({
      roomId,
      userId,
      status: 'joined',
      joinedAt: now,
      lastSeenAt: now,
    }).onConflictDoUpdate({
      target: [discussionParticipants.roomId, discussionParticipants.userId],
      set: { status: 'joined', joinedAt: now, leftAt: null, lastSeenAt: now },
    });
    await transaction.update(notifications).set({ readAt: now }).where(and(
      eq(notifications.recipientUserId, userId),
      eq(notifications.type, 'revision_room_invitation'),
      eq(notifications.resourceId, roomId),
    ));
  });
  return getRevisionRoom(userId, roomId);
}

export async function heartbeatRevisionRoom(userId: string, roomId: string) {
  await requireRoomAccess(userId, roomId);
  const lastSeenAt = new Date();
  const [participant] = await db.update(discussionParticipants).set({ lastSeenAt }).where(and(
    eq(discussionParticipants.roomId, roomId),
    eq(discussionParticipants.userId, userId),
    eq(discussionParticipants.status, 'joined'),
  )).returning({ userId: discussionParticipants.userId });
  if (!participant) throw new ApiError(409, 'REVISION_ROOM_NOT_JOINED', 'Join the room before sending presence updates.');
  return { lastSeenAt };
}

export async function startRevisionRoom(userId: string, userName: string, roomId: string) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.hostUserId !== userId) throw new ApiError(403, 'REVISION_ROOM_HOST_ONLY', 'Only the host can start the room.');
  if (room.status === 'ended') throw new ApiError(409, 'REVISION_ROOM_ENDED', 'This Revision Room has ended.');
  if (room.status === 'live') return getRevisionRoom(userId, roomId);
  const startedAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction.update(discussionRooms).set({ status: 'live', startedAt })
      .where(eq(discussionRooms.id, roomId));
    const recipients = await transaction.select({ userId: discussionParticipants.userId })
      .from(discussionParticipants)
      .where(and(
        eq(discussionParticipants.roomId, roomId),
        ne(discussionParticipants.userId, userId),
      ));
    if (recipients.length > 0) {
      await transaction.insert(notifications).values(recipients.map((recipient) => buildNotificationValues({
        recipientUserId: recipient.userId,
        actorUserId: userId,
        channel: 'study_squad',
        type: 'revision_room_started',
        title: `${userName} started the Revision Room`,
        body: `Your ${room.squadName ?? 'Study Squad'} room is live now.`,
        href: `/revision-room?roomId=${encodeURIComponent(roomId)}`,
        resourceId: roomId,
        dedupeKey: `revision-room-started:${roomId}:${recipient.userId}`,
        createdAt: startedAt,
      }))).onConflictDoNothing();
    }
  });
  return getRevisionRoom(userId, roomId);
}

export async function endRevisionRoom(userId: string, roomId: string) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.hostUserId !== userId) throw new ApiError(403, 'REVISION_ROOM_HOST_ONLY', 'Only the host can end the room.');
  if (room.status === 'ended') return getRevisionRoom(userId, roomId);
  if (room.status !== 'live') throw new ApiError(409, 'REVISION_ROOM_NOT_LIVE', 'Start the room before ending it.');
  const [utterance] = await db.select({ id: discussionUtterances.id })
    .from(discussionUtterances)
    .where(eq(discussionUtterances.roomId, roomId))
    .limit(1);
  const [work] = await db.select({ id: learningWork.id }).from(learningWork)
    .where(and(eq(learningWork.roomKind, 'revision'), eq(learningWork.roomId, roomId))).limit(1);
  if (!utterance && !work) throw new ApiError(409, 'REVISION_ROOM_EMPTY', 'Submit at least one handwritten solution before ending the room.');
  const endedAt = new Date();
  await db.update(discussionRooms).set({ status: 'ended', endedAt })
    .where(eq(discussionRooms.id, roomId));
  return getRevisionRoom(userId, roomId);
}

export async function addRevisionUtterance(input: {
  userId: string;
  roomId: string;
  submissionId: string;
  text: string;
  locale: string;
  provider: 'browser' | 'huawei';
  speakingMs: number;
}) {
  const { room } = await requireRoomAccess(input.userId, input.roomId);
  if (room.status !== 'live') throw new ApiError(409, 'REVISION_ROOM_NOT_LIVE', 'The host must start the room before you can submit an explanation.');
  const now = new Date();
  await db.transaction(async (transaction) => {
    const [participant] = await transaction.select({ status: discussionParticipants.status })
      .from(discussionParticipants)
      .where(and(
        eq(discussionParticipants.roomId, input.roomId),
        eq(discussionParticipants.userId, input.userId),
      )).limit(1);
    if (participant?.status !== 'joined') {
      throw new ApiError(409, 'REVISION_ROOM_NOT_JOINED', 'Join the room before submitting an explanation.');
    }
    const inserted = await transaction.insert(discussionUtterances).values({
      id: input.submissionId,
      roomId: input.roomId,
      userId: input.userId,
      text: input.text,
      locale: input.locale,
      provider: input.provider,
      spokenAt: now,
      createdAt: now,
    }).onConflictDoNothing().returning({ id: discussionUtterances.id });
    if (inserted.length > 0) {
      await transaction.update(discussionParticipants).set({
        speakingMs: sql`${discussionParticipants.speakingMs} + ${input.speakingMs}`,
        lastSeenAt: now,
      }).where(and(
        eq(discussionParticipants.roomId, input.roomId),
        eq(discussionParticipants.userId, input.userId),
      ));
    }
  });
  return getRevisionRoom(input.userId, input.roomId);
}

export async function inviteRevisionParticipants(
  userId: string,
  userName: string,
  roomId: string,
  userIds: string[],
) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.hostUserId !== userId) throw new ApiError(403, 'REVISION_ROOM_HOST_ONLY', 'Only the host can invite participants.');
  if (room.status === 'ended') throw new ApiError(409, 'REVISION_ROOM_ENDED', 'This Revision Room has ended.');
  const members = await loadInvitedMembers(room.squadId!, userId, userIds);
  const now = new Date();
  await db.transaction(async (transaction) => {
    if (members.length > 0) {
      await transaction.insert(discussionParticipants).values(members.map((member) => ({
        roomId,
        userId: member.userId,
        status: 'invited' as const,
        joinedAt: now,
        lastSeenAt: now,
      }))).onConflictDoNothing();
      await transaction.insert(notifications).values(members.map((member) => buildNotificationValues({
        recipientUserId: member.userId,
        actorUserId: userId,
        channel: 'study_squad',
        type: 'revision_room_invitation',
        title: `${userName} invited you to a Revision Room`,
        body: `Join ${room.squadName ?? 'your Study Squad'} and explain this topic together.`,
        href: `/revision-room?roomId=${encodeURIComponent(roomId)}`,
        resourceId: roomId,
        dedupeKey: `revision-room-invitation:${roomId}:${member.userId}`,
        createdAt: now,
      }))).onConflictDoNothing();
    }
  });
  return getRevisionRoom(userId, roomId);
}
