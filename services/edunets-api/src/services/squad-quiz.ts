import { createHash, randomUUID } from 'node:crypto';
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { notifications } from '../../../../database/schema/notifications.js';
import {
  squadQuizRoomAnswers,
  squadQuizRoomCompletions,
  squadQuizRoomParticipants,
  squadQuizRoomQuestions,
  squadQuizRooms,
} from '../../../../database/schema/squad-quiz.js';
import { studySquadMembers, studySquads } from '../../../../database/schema/study-squads.js';
import { ApiError } from '../errors.js';
import { getQuestionByKey, getQuestionsForTopic, gradeQuestion, type QuizQuestion } from '../lib/question-bank.js';
import { buildNotificationValues } from './notifications.js';

const QUESTION_SECONDS = 45;
const QUESTION_COUNT = 3;
const ONLINE_WINDOW_MS = 20_000;

type AvatarColor = 'Yellow' | 'LightBlue' | 'White';

async function loadMembership(userId: string) {
  const [membership] = await db.select({
    squadId: studySquadMembers.squadId,
    squadName: studySquads.name,
    role: studySquadMembers.role,
  })
    .from(studySquadMembers)
    .innerJoin(studySquads, eq(studySquads.id, studySquadMembers.squadId))
    .where(eq(studySquadMembers.userId, userId))
    .limit(1);
  return membership ?? null;
}

async function loadRoom(roomId: string) {
  const [room] = await db.select({
    id: squadQuizRooms.id,
    squadId: squadQuizRooms.squadId,
    squadName: studySquads.name,
    hostUserId: squadQuizRooms.hostUserId,
    hostName: users.name,
    topicId: squadQuizRooms.topicId,
    topicName: topics.name,
    subjectId: subjects.id,
    subjectName: subjects.name,
    status: squadQuizRooms.status,
    currentQuestionIndex: squadQuizRooms.currentQuestionIndex,
    totalRounds: squadQuizRooms.totalRounds,
    questionStartedAt: squadQuizRooms.questionStartedAt,
    restartCount: squadQuizRooms.restartCount,
    createdAt: squadQuizRooms.createdAt,
    finishedAt: squadQuizRooms.finishedAt,
  })
    .from(squadQuizRooms)
    .innerJoin(studySquads, eq(studySquads.id, squadQuizRooms.squadId))
    .innerJoin(users, eq(users.id, squadQuizRooms.hostUserId))
    .innerJoin(topics, eq(topics.id, squadQuizRooms.topicId))
    .innerJoin(subjects, eq(subjects.id, topics.subjectId))
    .where(eq(squadQuizRooms.id, roomId))
    .limit(1);
  return room ?? null;
}

async function requireRoomAccess(userId: string, roomId: string) {
  const [membership, room] = await Promise.all([loadMembership(userId), loadRoom(roomId)]);
  if (!room) throw new ApiError(404, 'SQUAD_QUIZ_ROOM_NOT_FOUND', 'This Rescue quiz room was not found.');
  if (!membership || membership.squadId !== room.squadId) {
    throw new ApiError(403, 'SQUAD_QUIZ_ROOM_FORBIDDEN', 'Only members of this Study Squad can open the room.');
  }
  return { membership, room };
}

function serializeQuestion(question: QuizQuestion, questionIndex: number) {
  return {
    questionIndex,
    questionKey: question.questionKey,
    type: question.type,
    text: question.text,
    options: question.options ?? null,
  };
}

export async function getSquadQuizRoom(userId: string, roomId: string) {
  const { room } = await requireRoomAccess(userId, roomId);
  const [participantRows, questionRow, currentAnswer] = await Promise.all([
    db.select({
      userId: squadQuizRoomParticipants.userId,
      displayName: squadQuizRoomParticipants.displayName,
      avatarColor: squadQuizRoomParticipants.avatarColor,
      status: squadQuizRoomParticipants.status,
      score: squadQuizRoomParticipants.score,
      lastAnswerCorrect: squadQuizRoomParticipants.lastAnswerCorrect,
      joinedAt: squadQuizRoomParticipants.joinedAt,
      lastSeenAt: squadQuizRoomParticipants.lastSeenAt,
    })
      .from(squadQuizRoomParticipants)
      .where(eq(squadQuizRoomParticipants.roomId, roomId))
      .orderBy(asc(squadQuizRoomParticipants.joinedAt), asc(squadQuizRoomParticipants.userId)),
    db.select({ questionKey: squadQuizRoomQuestions.questionKey })
      .from(squadQuizRoomQuestions)
      .where(and(
        eq(squadQuizRoomQuestions.roomId, roomId),
        eq(squadQuizRoomQuestions.questionIndex, room.currentQuestionIndex),
      ))
      .limit(1),
    db.select({
      isCorrect: squadQuizRoomAnswers.isCorrect,
      points: squadQuizRoomAnswers.points,
    })
      .from(squadQuizRoomAnswers)
      .where(and(
        eq(squadQuizRoomAnswers.roomId, roomId),
        eq(squadQuizRoomAnswers.userId, userId),
        eq(squadQuizRoomAnswers.questionIndex, room.currentQuestionIndex),
      ))
      .limit(1),
  ]);
  const keyedQuestion = questionRow[0]
    ? await getQuestionByKey(questionRow[0].questionKey)
    : null;
  if (!keyedQuestion) throw new ApiError(500, 'SQUAD_QUIZ_QUESTION_MISSING', 'The current room question is unavailable.');

  const now = new Date();
  const onlineCutoff = now.getTime() - ONLINE_WINDOW_MS;
  const currentParticipant = participantRows.find((participant) => participant.userId === userId) ?? null;
  const answer = currentAnswer[0] ?? null;
  return {
    room: {
      ...room,
      questionEndsAt: new Date(room.questionStartedAt.getTime() + QUESTION_SECONDS * 1_000),
      serverNow: now,
      canManage: room.hostUserId === userId,
      hasJoined: Boolean(currentParticipant && !['invited', 'left'].includes(currentParticipant.status)),
      currentQuestion: serializeQuestion(keyedQuestion, room.currentQuestionIndex),
      currentUserAnswer: answer ? {
        ...answer,
        explanation: keyedQuestion.explanation,
      } : null,
      participants: participantRows.map((participant) => ({
        ...participant,
        presence: participant.status === 'invited'
          ? 'invited'
          : participant.status === 'left'
            ? 'left'
            : participant.status === 'finished' || room.status === 'finished'
              ? 'finished'
              : participant.lastSeenAt && participant.lastSeenAt.getTime() >= onlineCutoff
                ? 'online'
                : 'away',
        answeredCurrent: participant.status === 'answered',
      })),
    },
  };
}

function selectRoomQuestions(questions: QuizQuestion[], seed: string): QuizQuestion[] {
  return questions
    .filter((question) => question.type === 'mcq' && question.options && question.options.length >= 2)
    .sort((left, right) => (
      createHash('sha256').update(`${seed}:${left.questionKey}`).digest('hex')
        .localeCompare(createHash('sha256').update(`${seed}:${right.questionKey}`).digest('hex'))
    ))
    .slice(0, QUESTION_COUNT);
}

export async function createSquadQuizRoom(input: {
  userId: string;
  userName: string;
  topicId: string;
  invitedUserIds: string[];
  message?: string;
}) {
  const membership = await loadMembership(input.userId);
  if (!membership) throw new ApiError(404, 'SQUAD_NOT_FOUND', 'Join a Study Squad before starting a Rescue quiz.');
  const roomId = randomUUID();
  const [questionPool, topicRows] = await Promise.all([
    getQuestionsForTopic(input.topicId),
    db.select({ id: topics.id })
      .from(topics)
      .where(eq(topics.id, input.topicId))
      .limit(1),
  ]);
  if (!topicRows[0]) throw new ApiError(404, 'TOPIC_NOT_FOUND', 'That quiz topic was not found.');
  const questions = selectRoomQuestions(questionPool, roomId);
  if (questions.length < QUESTION_COUNT) {
    throw new ApiError(409, 'SQUAD_QUIZ_UNAVAILABLE', 'This topic does not have three Kahoot-ready MCQs yet.');
  }

  const invitedIds = [...new Set(input.invitedUserIds)].filter((candidate) => candidate !== input.userId);
  const invitedMembers = invitedIds.length === 0 ? [] : await db.select({
    userId: studySquadMembers.userId,
    name: users.name,
  })
    .from(studySquadMembers)
    .innerJoin(users, eq(users.id, studySquadMembers.userId))
    .where(and(
      eq(studySquadMembers.squadId, membership.squadId),
      inArray(studySquadMembers.userId, invitedIds),
    ));
  if (invitedMembers.length !== invitedIds.length) {
    throw new ApiError(400, 'INVALID_SQUAD_QUIZ_INVITEE', 'Every invited participant must belong to your Study Squad.');
  }

  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.insert(squadQuizRooms).values({
      id: roomId,
      squadId: membership.squadId,
      hostUserId: input.userId,
      topicId: input.topicId,
      status: 'active',
      currentQuestionIndex: 0,
      totalRounds: questions.length,
      questionStartedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await transaction.insert(squadQuizRoomQuestions).values(questions.map((question, questionIndex) => ({
      roomId,
      questionIndex,
      questionKey: question.questionKey,
    })));
    await transaction.insert(squadQuizRoomParticipants).values([
      {
        roomId,
        userId: input.userId,
        displayName: input.userName,
        avatarColor: 'Yellow' as const,
        status: 'joined' as const,
        score: 0,
        joinedAt: now,
        lastSeenAt: now,
        updatedAt: now,
      },
      ...invitedMembers.map((member, index) => ({
        roomId,
        userId: member.userId,
        displayName: member.name,
        avatarColor: (['LightBlue', 'White', 'Yellow'] as const)[index % 3] ?? 'Yellow',
        status: 'invited' as const,
        score: 0,
        updatedAt: now,
      })),
    ]);
    if (invitedMembers.length > 0) {
      await transaction.insert(notifications).values(invitedMembers.map((member) => buildNotificationValues({
        recipientUserId: member.userId,
        actorUserId: input.userId,
        channel: 'study_squad',
        type: 'squad_quiz_invitation',
        title: `${input.userName} started a live Rescue quiz`,
        body: input.message?.trim() || `Join ${membership.squadName} for a three-round live quiz.`,
        href: `/rescue-join?roomId=${encodeURIComponent(roomId)}`,
        resourceId: roomId,
        dedupeKey: `squad-quiz-invitation:${roomId}:${member.userId}`,
        createdAt: now,
      })));
    }
  });
  return getSquadQuizRoom(input.userId, roomId);
}

export async function joinSquadQuizRoom(
  userId: string,
  userName: string,
  roomId: string,
  avatarColor: AvatarColor,
) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.status !== 'active') throw new ApiError(409, 'SQUAD_QUIZ_FINISHED', 'This Rescue quiz has already finished.');
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.insert(squadQuizRoomParticipants).values({
      roomId,
      userId,
      displayName: userName,
      avatarColor,
      status: 'joined',
      score: 0,
      joinedAt: now,
      lastSeenAt: now,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [squadQuizRoomParticipants.roomId, squadQuizRoomParticipants.userId],
      set: {
        displayName: userName,
        avatarColor,
        status: sql`case when ${squadQuizRoomParticipants.status} in ('invited', 'left') then 'joined' else ${squadQuizRoomParticipants.status} end`,
        joinedAt: sql`coalesce(${squadQuizRoomParticipants.joinedAt}, ${now})`,
        lastSeenAt: now,
        updatedAt: now,
      },
    });
    await transaction.update(notifications).set({ readAt: now }).where(and(
      eq(notifications.recipientUserId, userId),
      eq(notifications.type, 'squad_quiz_invitation'),
      eq(notifications.resourceId, roomId),
    ));
  });
  return getSquadQuizRoom(userId, roomId);
}

export async function heartbeatSquadQuizRoom(userId: string, roomId: string) {
  await requireRoomAccess(userId, roomId);
  const now = new Date();
  const [participant] = await db.update(squadQuizRoomParticipants).set({ lastSeenAt: now, updatedAt: now }).where(and(
    eq(squadQuizRoomParticipants.roomId, roomId),
    eq(squadQuizRoomParticipants.userId, userId),
    ne(squadQuizRoomParticipants.status, 'invited'),
    ne(squadQuizRoomParticipants.status, 'left'),
  )).returning({ userId: squadQuizRoomParticipants.userId });
  if (!participant) throw new ApiError(409, 'SQUAD_QUIZ_NOT_JOINED', 'Join the room before sending presence updates.');
  return { lastSeenAt: now };
}

export async function submitSquadQuizAnswer(input: {
  userId: string;
  roomId: string;
  questionIndex: number;
  answer: string | number;
}) {
  await requireRoomAccess(input.userId, input.roomId);
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`squad-quiz:${input.roomId}`}))`);
    const [room] = await transaction.select({
      status: squadQuizRooms.status,
      currentQuestionIndex: squadQuizRooms.currentQuestionIndex,
      questionStartedAt: squadQuizRooms.questionStartedAt,
    }).from(squadQuizRooms).where(eq(squadQuizRooms.id, input.roomId)).limit(1);
    if (!room || room.status !== 'active') throw new ApiError(409, 'SQUAD_QUIZ_FINISHED', 'This Rescue quiz has finished.');
    if (room.currentQuestionIndex !== input.questionIndex) {
      throw new ApiError(409, 'SQUAD_QUIZ_ROUND_CHANGED', 'The room has already moved to another question.');
    }
    if (Date.now() >= room.questionStartedAt.getTime() + QUESTION_SECONDS * 1_000) {
      throw new ApiError(409, 'SQUAD_QUIZ_ROUND_CLOSED', 'Time is up for this question.');
    }
    const [participant] = await transaction.select({ status: squadQuizRoomParticipants.status })
      .from(squadQuizRoomParticipants)
      .where(and(
        eq(squadQuizRoomParticipants.roomId, input.roomId),
        eq(squadQuizRoomParticipants.userId, input.userId),
      )).limit(1);
    if (!participant || ['invited', 'left'].includes(participant.status)) {
      throw new ApiError(409, 'SQUAD_QUIZ_NOT_JOINED', 'Join the room before answering.');
    }
    const [existing] = await transaction.select({ questionIndex: squadQuizRoomAnswers.questionIndex })
      .from(squadQuizRoomAnswers)
      .where(and(
        eq(squadQuizRoomAnswers.roomId, input.roomId),
        eq(squadQuizRoomAnswers.userId, input.userId),
        eq(squadQuizRoomAnswers.questionIndex, input.questionIndex),
      )).limit(1);
    if (existing) return;
    const [questionRow] = await transaction.select({ questionKey: squadQuizRoomQuestions.questionKey })
      .from(squadQuizRoomQuestions)
      .where(and(
        eq(squadQuizRoomQuestions.roomId, input.roomId),
        eq(squadQuizRoomQuestions.questionIndex, input.questionIndex),
      )).limit(1);
    const question = questionRow ? await getQuestionByKey(questionRow.questionKey) : null;
    if (!question) throw new ApiError(500, 'SQUAD_QUIZ_QUESTION_MISSING', 'The room question is unavailable.');
    const correct = gradeQuestion(question, input.answer);
    const answeredAt = new Date();
    await transaction.insert(squadQuizRoomAnswers).values({
      roomId: input.roomId,
      userId: input.userId,
      questionIndex: input.questionIndex,
      submittedAnswer: String(input.answer),
      isCorrect: correct,
      points: correct ? 10 : 0,
      answeredAt,
    });
    await transaction.update(squadQuizRoomParticipants).set({
      score: sql`${squadQuizRoomParticipants.score} + ${correct ? 10 : 0}`,
      status: 'answered',
      lastAnswerCorrect: correct,
      lastSeenAt: answeredAt,
      updatedAt: answeredAt,
    }).where(and(
      eq(squadQuizRoomParticipants.roomId, input.roomId),
      eq(squadQuizRoomParticipants.userId, input.userId),
    ));
  });
  return getSquadQuizRoom(input.userId, input.roomId);
}

export async function advanceSquadQuizRoom(userId: string, roomId: string) {
  await requireRoomAccess(userId, roomId);
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`squad-quiz:${roomId}`}))`);
    const [room] = await transaction.select()
      .from(squadQuizRooms)
      .where(eq(squadQuizRooms.id, roomId))
      .limit(1);
    if (!room || room.status === 'finished') return;
    const activeParticipants = await transaction.select({
      userId: squadQuizRoomParticipants.userId,
      status: squadQuizRoomParticipants.status,
    })
      .from(squadQuizRoomParticipants)
      .where(and(
        eq(squadQuizRoomParticipants.roomId, roomId),
        ne(squadQuizRoomParticipants.status, 'invited'),
        ne(squadQuizRoomParticipants.status, 'left'),
      ));
    const allAnswered = activeParticipants.length > 0
      && activeParticipants.every((participant) => participant.status === 'answered');
    const timeExpired = Date.now() >= room.questionStartedAt.getTime() + QUESTION_SECONDS * 1_000;
    if (!allAnswered && !timeExpired) {
      throw new ApiError(409, 'SQUAD_QUIZ_ROUND_ACTIVE', 'The round is still active.');
    }
    const changedAt = new Date();
    if (room.currentQuestionIndex >= room.totalRounds - 1) {
      await transaction.insert(squadQuizRoomCompletions).values({
        roomId,
        runNumber: room.restartCount,
        completedAt: changedAt,
      }).onConflictDoNothing();
      await transaction.update(squadQuizRooms).set({
        status: 'finished',
        finishedAt: changedAt,
        updatedAt: changedAt,
      }).where(eq(squadQuizRooms.id, roomId));
      await transaction.update(squadQuizRoomParticipants).set({
        status: 'finished',
        updatedAt: changedAt,
      }).where(and(
        eq(squadQuizRoomParticipants.roomId, roomId),
        ne(squadQuizRoomParticipants.status, 'invited'),
        ne(squadQuizRoomParticipants.status, 'left'),
      ));
      const recipients = activeParticipants
        .map((participant) => participant.userId)
        .filter((participantId) => participantId !== userId);
      if (recipients.length > 0) {
        await transaction.insert(notifications).values(recipients.map((recipientUserId) => buildNotificationValues({
          recipientUserId,
          actorUserId: room.hostUserId,
          channel: 'study_squad',
          type: 'squad_quiz_finished',
          title: 'Your live Rescue quiz finished',
          body: 'Open the room to see the final leaderboard.',
          href: `/rescue-room?roomId=${encodeURIComponent(roomId)}`,
          resourceId: roomId,
          dedupeKey: `squad-quiz-finished:${roomId}:${room.restartCount}:${recipientUserId}`,
          createdAt: changedAt,
        }))).onConflictDoNothing();
      }
    } else {
      await transaction.update(squadQuizRooms).set({
        currentQuestionIndex: room.currentQuestionIndex + 1,
        questionStartedAt: changedAt,
        updatedAt: changedAt,
      }).where(eq(squadQuizRooms.id, roomId));
      await transaction.update(squadQuizRoomParticipants).set({
        status: 'joined',
        lastAnswerCorrect: null,
        updatedAt: changedAt,
      }).where(and(
        eq(squadQuizRoomParticipants.roomId, roomId),
        ne(squadQuizRoomParticipants.status, 'invited'),
        ne(squadQuizRoomParticipants.status, 'left'),
      ));
    }
  });
  return getSquadQuizRoom(userId, roomId);
}

export async function restartSquadQuizRoom(userId: string, roomId: string) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.hostUserId !== userId) throw new ApiError(403, 'SQUAD_QUIZ_HOST_ONLY', 'Only the room host can restart it.');
  const restartedAt = new Date();
  await db.transaction(async (transaction) => {
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`squad-quiz:${roomId}`}))`);
    await transaction.delete(squadQuizRoomAnswers).where(eq(squadQuizRoomAnswers.roomId, roomId));
    await transaction.update(squadQuizRooms).set({
      status: 'active',
      currentQuestionIndex: 0,
      questionStartedAt: restartedAt,
      restartCount: sql`${squadQuizRooms.restartCount} + 1`,
      finishedAt: null,
      updatedAt: restartedAt,
    }).where(eq(squadQuizRooms.id, roomId));
    await transaction.update(squadQuizRoomParticipants).set({
      status: 'joined',
      score: 0,
      lastAnswerCorrect: null,
      lastSeenAt: restartedAt,
      updatedAt: restartedAt,
    }).where(and(
      eq(squadQuizRoomParticipants.roomId, roomId),
      ne(squadQuizRoomParticipants.status, 'invited'),
      ne(squadQuizRoomParticipants.status, 'left'),
    ));
  });
  return getSquadQuizRoom(userId, roomId);
}

export async function inviteSquadQuizParticipants(
  userId: string,
  userName: string,
  roomId: string,
  invitedUserIds: string[],
) {
  const { room } = await requireRoomAccess(userId, roomId);
  if (room.hostUserId !== userId) throw new ApiError(403, 'SQUAD_QUIZ_HOST_ONLY', 'Only the room host can invite participants.');
  if (room.status !== 'active') throw new ApiError(409, 'SQUAD_QUIZ_FINISHED', 'This Rescue quiz has finished.');
  const uniqueIds = [...new Set(invitedUserIds)].filter((candidate) => candidate !== userId);
  const invitees = await db.select({ userId: studySquadMembers.userId, name: users.name })
    .from(studySquadMembers)
    .innerJoin(users, eq(users.id, studySquadMembers.userId))
    .where(and(
      eq(studySquadMembers.squadId, room.squadId),
      inArray(studySquadMembers.userId, uniqueIds),
    ));
  if (invitees.length !== uniqueIds.length) {
    throw new ApiError(400, 'INVALID_SQUAD_QUIZ_INVITEE', 'Every invited participant must belong to this Study Squad.');
  }
  const now = new Date();
  await db.transaction(async (transaction) => {
    await transaction.insert(squadQuizRoomParticipants).values(invitees.map((member, index) => ({
      roomId,
      userId: member.userId,
      displayName: member.name,
      avatarColor: (['LightBlue', 'White', 'Yellow'] as const)[index % 3] ?? 'Yellow',
      status: 'invited' as const,
      score: 0,
      updatedAt: now,
    }))).onConflictDoNothing();
    await transaction.insert(notifications).values(invitees.map((member) => buildNotificationValues({
      recipientUserId: member.userId,
      actorUserId: userId,
      channel: 'study_squad',
      type: 'squad_quiz_invitation',
      title: `${userName} invited you to a live Rescue quiz`,
      body: `${room.subjectName} · ${room.topicName}`,
      href: `/rescue-join?roomId=${encodeURIComponent(roomId)}`,
      resourceId: roomId,
      dedupeKey: `squad-quiz-invitation:${roomId}:${member.userId}`,
      createdAt: now,
    }))).onConflictDoNothing();
  });
  return getSquadQuizRoom(userId, roomId);
}
