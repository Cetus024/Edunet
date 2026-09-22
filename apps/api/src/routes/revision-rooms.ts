import { Hono, type Context } from 'hono';

import { ApiError, readJson } from '../errors.js';
import { loadSession, requireSession } from '../middleware/session.js';
import {
  addRevisionUtterance,
  createRevisionRoom,
  endRevisionRoom,
  getRevisionRoom,
  heartbeatRevisionRoom,
  inviteRevisionParticipants,
  joinRevisionRoom,
  startRevisionRoom,
} from '../services/revision-rooms.js';
import type { AppEnv } from '../types.js';
import {
  createRevisionRoomSchema,
  revisionRoomIdSchema,
  revisionRoomInviteSchema,
  revisionUtteranceSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();

function requireUser(context: Context<AppEnv>) {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user;
}

api.post('/me/revision-rooms', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const input = createRevisionRoomSchema.parse(await readJson(context));
  return context.json(await createRevisionRoom({ userId: user.id, userName: user.name, ...input }), 201);
});

api.get('/me/revision-rooms/:roomId', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  return context.json(await getRevisionRoom(user.id, revisionRoomIdSchema.parse(context.req.param('roomId'))));
});

api.post('/me/revision-rooms/:roomId/join', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  return context.json(await joinRevisionRoom(user.id, revisionRoomIdSchema.parse(context.req.param('roomId'))));
});

api.post('/me/revision-rooms/:roomId/heartbeat', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  return context.json(await heartbeatRevisionRoom(user.id, revisionRoomIdSchema.parse(context.req.param('roomId'))));
});

api.post('/me/revision-rooms/:roomId/start', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  return context.json(await startRevisionRoom(user.id, user.name, revisionRoomIdSchema.parse(context.req.param('roomId'))));
});

api.post('/me/revision-rooms/:roomId/end', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  return context.json(await endRevisionRoom(user.id, revisionRoomIdSchema.parse(context.req.param('roomId'))));
});

api.post('/me/revision-rooms/:roomId/utterances', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = revisionRoomIdSchema.parse(context.req.param('roomId'));
  const input = revisionUtteranceSchema.parse(await readJson(context));
  return context.json(await addRevisionUtterance({ userId: user.id, roomId, ...input }));
});

api.post('/me/revision-rooms/:roomId/invitations', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const roomId = revisionRoomIdSchema.parse(context.req.param('roomId'));
  const input = revisionRoomInviteSchema.parse(await readJson(context));
  return context.json(await inviteRevisionParticipants(user.id, user.name, roomId, input.userIds));
});

export { api as revisionRoomsApi };
