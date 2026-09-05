import { and, desc, eq, sql } from 'drizzle-orm';
import { ZodError } from 'zod';
import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { discussionParticipants, discussionRooms } from '../../../../database/schema/discussion.js';
import { learningWork } from '../../../../database/schema/learning-work.js';
import { squadQuizRoomParticipants, squadQuizRooms } from '../../../../database/schema/squad-quiz.js';
import { studySquadMembers } from '../../../../database/schema/study-squads.js';
import type { WorkInput } from '../../../../lib/learning-work.js';
import { ApiError } from '../errors.js';
import { getQuestionByKey } from '../lib/question-bank.js';
import { getAnalysisModel } from './analysis-model.js';
import { buildTopicGrounding } from './explanation-analysis.js';
import { getRevisionRoom } from './revision-rooms.js';
import { getSquadQuizRoom } from './squad-quiz.js';
import { analyseWork } from './work-analysis.js';

export async function listLearningWork(kind: 'rescue' | 'revision', roomId: string, userId?: string) {
  const rows = await db.select({
    id: learningWork.id, userId: learningWork.userId, displayName: users.name,
    question: learningWork.question, transcript: learningWork.transcript, strokes: learningWork.strokes,
    analysis: learningWork.analysis, createdAt: learningWork.createdAt,
    questionIndex: learningWork.questionIndex, runNumber: learningWork.runNumber,
  }).from(learningWork).innerJoin(users, eq(users.id, learningWork.userId))
    .where(and(eq(learningWork.roomKind, kind), eq(learningWork.roomId, roomId),
      userId ? eq(learningWork.userId, userId) : undefined))
    .orderBy(desc(learningWork.createdAt)).limit(100);
  return rows.reverse();
}

export async function submitLearningWork(kind: 'rescue' | 'revision', roomId: string, userId: string, input: WorkInput) {
  const room = kind === 'rescue'
    ? (await getSquadQuizRoom(userId, roomId)).room
    : (await getRevisionRoom(userId, roomId)).room;
  if (!room.hasJoined) throw new ApiError(403, 'WORK_NOT_JOINED', 'Join the room before submitting work.');
  const [existing] = await db.select().from(learningWork).where(eq(learningWork.id, input.submissionId)).limit(1);
  if (existing) {
    if (existing.roomId !== roomId || existing.roomKind !== kind || existing.userId !== userId) {
      throw new ApiError(409, 'WORK_ID_CONFLICT', 'This submission ID is already in use.');
    }
    return { work: { ...existing, displayName: room.participants.find((participant) => participant.userId === userId)?.displayName ?? '' } };
  }
  let question = input.question;
  let reference: string | undefined;
  if ('currentQuestion' in room) {
    if (room.status !== 'active' || room.currentQuestionIndex !== input.questionIndex || room.restartCount !== input.runNumber) {
      throw new ApiError(409, 'WORK_ROUND_CHANGED', 'This round has ended. Your drawing has not been submitted.');
    }
    const source = await getQuestionByKey(room.currentQuestion.questionKey);
    if (!source) throw new ApiError(409, 'WORK_QUESTION_MISSING', 'The room question is unavailable.');
    question = source.text + (source.options ? '\n' + source.options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n') : '');
    const answer = source.type === 'mcq' && typeof source.correctAnswer === 'number'
      ? source.options?.[source.correctAnswer] : source.correctAnswer;
    reference = `Question-bank answer: ${answer ?? 'unavailable'}. Explanation: ${source.explanation}`;
  } else if (room.status !== 'live' || !question.trim()) {
    throw new ApiError(409, 'WORK_NOT_LIVE', 'Start the room and enter the original question before submitting.');
  }
  const model = getAnalysisModel();
  if (!model) throw new ApiError(503, 'WORK_ANALYSIS_UNAVAILABLE', 'AI analysis is not configured. Your drawing and text are still available to edit.');
  let analysis;
  try {
    const grounding = await buildTopicGrounding(room.topicId);
    analysis = await analyseWork({ question, transcript: input.transcript, locale: input.locale, grounding, ...(reference ? { reference } : {}) }, model);
  } catch (error) {
    const rateLimited = error instanceof Error && /HTTP 429\b/.test(error.message);
    console.warn(JSON.stringify({
      event: 'handwritten-analysis-failed',
      reason: rateLimited ? 'rate_limited' : error instanceof ZodError || error instanceof SyntaxError ? 'invalid_response'
        : error instanceof Error && error.message.includes('quoted text') ? 'unmatched_quote'
          : 'provider_or_grounding_error',
    }));
    if (rateLimited) throw new ApiError(429, 'WORK_ANALYSIS_BUSY', 'The analysis service is busy. Wait a moment and retry; your drawing and text are retained.');
    throw new ApiError(502, 'WORK_ANALYSIS_FAILED', 'Analysis could not be completed reliably. Keep your work and try again.');
  }
  await db.transaction(async (transaction) => {
    // Serialize against advance/restart/end so a slow model cannot save into another round.
    await transaction.execute(sql`select pg_advisory_xact_lock(hashtext(${`${kind === 'rescue' ? 'squad-quiz' : 'revision-work'}:${roomId}`}))`);
    const [replayed] = await transaction.select().from(learningWork).where(eq(learningWork.id, input.submissionId));
    if (replayed) {
      if (replayed.userId !== userId || replayed.roomId !== roomId || replayed.roomKind !== kind) {
        throw new ApiError(409, 'WORK_ID_CONFLICT', 'This submission ID is already in use.');
      }
      return;
    }
    const [membership] = await transaction.select({ userId: studySquadMembers.userId }).from(studySquadMembers)
      .where(and(eq(studySquadMembers.userId, userId), eq(studySquadMembers.squadId, room.squadId!)));
    if (!membership) throw new ApiError(403, 'WORK_MEMBERSHIP_CHANGED', 'You are no longer a member of this squad.');
    if (kind === 'rescue') {
      const [latest] = await transaction.select().from(squadQuizRooms).where(eq(squadQuizRooms.id, roomId));
      if (!latest || latest.status !== 'active' || latest.currentQuestionIndex !== input.questionIndex || latest.restartCount !== input.runNumber) {
        throw new ApiError(409, 'WORK_ROUND_CHANGED', 'The round changed while analysis was running. Your work is still in the editor.');
      }
      const [participant] = await transaction.select({ status: squadQuizRoomParticipants.status }).from(squadQuizRoomParticipants)
        .where(and(eq(squadQuizRoomParticipants.roomId, roomId), eq(squadQuizRoomParticipants.userId, userId)));
      if (!participant || !['joined', 'answered'].includes(participant.status)) throw new ApiError(403, 'WORK_NOT_JOINED', 'Rejoin the room before submitting.');
    } else {
      const [latest] = await transaction.select().from(discussionRooms).where(eq(discussionRooms.id, roomId)).for('update');
      if (!latest || latest.status !== 'live') throw new ApiError(409, 'WORK_ROOM_ENDED', 'The room ended while analysis was running.');
      const [participant] = await transaction.select({ status: discussionParticipants.status }).from(discussionParticipants)
        .where(and(eq(discussionParticipants.roomId, roomId), eq(discussionParticipants.userId, userId)));
      if (participant?.status !== 'joined') throw new ApiError(403, 'WORK_NOT_JOINED', 'Rejoin the room before submitting.');
    }
    if (kind === 'rescue') {
      // Keep one reviewed solution per student/round; permit a corrected resubmission.
      await transaction.delete(learningWork).where(and(eq(learningWork.roomKind, 'rescue'), eq(learningWork.roomId, roomId),
        eq(learningWork.userId, userId), eq(learningWork.questionIndex, input.questionIndex), eq(learningWork.runNumber, input.runNumber)));
    }
    const inserted = await transaction.insert(learningWork).values({
      id: input.submissionId, roomKind: kind, roomId, userId, question,
      transcript: input.transcript, strokes: input.strokes, analysis,
      questionIndex: kind === 'rescue' ? input.questionIndex : 0,
      runNumber: kind === 'rescue' ? input.runNumber : 0,
    }).onConflictDoNothing().returning({ id: learningWork.id });
    if (!inserted.length) throw new ApiError(409, 'WORK_ID_CONFLICT', 'This submission ID is already in use.');
    if (inserted.length && kind === 'rescue') {
      await transaction.update(squadQuizRoomParticipants).set({ status: 'answered', lastAnswerCorrect: null, lastSeenAt: new Date() })
        .where(and(eq(squadQuizRoomParticipants.roomId, roomId), eq(squadQuizRoomParticipants.userId, userId)));
    }
    if (kind === 'revision') {
      await transaction.update(discussionParticipants).set({ lastSeenAt: new Date() })
        .where(and(eq(discussionParticipants.roomId, roomId), eq(discussionParticipants.userId, userId)));
    }
  });
  const [work] = await db.select().from(learningWork).where(and(eq(learningWork.id, input.submissionId),
    eq(learningWork.userId, userId), eq(learningWork.roomId, roomId), eq(learningWork.roomKind, kind)));
  if (!work) throw new ApiError(409, 'WORK_ID_CONFLICT', 'This submission could not be saved. Please try again.');
  return { work: { ...work, displayName: room.participants.find((participant) => participant.userId === userId)?.displayName ?? '' } };
}
