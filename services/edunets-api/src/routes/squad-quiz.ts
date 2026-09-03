import { Hono, type Context } from 'hono';

import { ApiError, readJson } from '../errors.js';
import { loadSession, requireSession } from '../middleware/session.js';
import {
  advanceSquadQuizRoom,
  createSquadQuizRoom,
  getSquadQuizRoom,
  heartbeatSquadQuizRoom,
  inviteSquadQuizParticipants,
  joinSquadQuizRoom,
  restartSquadQuizRoom,
  submitSquadQuizAnswer,
} from '../services/squad-quiz.js';
import type { AppEnv } from '../types.js';
import {
  createSquadQuizRoomSchema,
  inviteSquadQuizParticipantsSchema,
  joinSquadQuizRoomSchema,
  squadQuizRoomIdSchema,
  submitSquadQuizAnswerSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();

function requireUser(context: Context<AppEnv>) {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user;
}

api.post('/me/squad-quiz-rooms', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const input = createSquadQuizRoomSchema.parse(await readJson(context));
  return context.json(await createSquadQuizRoom({
    userId: user.id,
    userName: user.name,
    topicId: input.topicId,
    invitedUserIds: input.invitedUserIds,
    ...(input.message ? { message: input.message } : {}),
  }), 201);
});

api.get('/me/squad-quiz-rooms/:roomId', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  return context.json(await getSquadQuizRoom(user.id, roomId));
});

api.post('/me/squad-quiz-rooms/:roomId/join', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  const input = joinSquadQuizRoomSchema.parse(await readJson(context));
  return context.json(await joinSquadQuizRoom(user.id, user.name, roomId, input.avatarColor));
});

api.post('/me/squad-quiz-rooms/:roomId/heartbeat', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  return context.json(await heartbeatSquadQuizRoom(user.id, roomId));
});

api.post('/me/squad-quiz-rooms/:roomId/answers', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  const input = submitSquadQuizAnswerSchema.parse(await readJson(context));
  return context.json(await submitSquadQuizAnswer({ userId: user.id, roomId, ...input }));
});

api.post('/me/squad-quiz-rooms/:roomId/advance', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  return context.json(await advanceSquadQuizRoom(user.id, roomId));
});

api.post('/me/squad-quiz-rooms/:roomId/restart', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  return context.json(await restartSquadQuizRoom(user.id, roomId));
});

api.post('/me/squad-quiz-rooms/:roomId/invitations', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = squadQuizRoomIdSchema.parse(context.req.param('roomId'));
  const input = inviteSquadQuizParticipantsSchema.parse(await readJson(context));
  return context.json(await inviteSquadQuizParticipants(user.id, user.name, roomId, input.userIds));
});

export { api as squadQuizApi };
