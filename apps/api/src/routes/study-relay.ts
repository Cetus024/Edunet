import { Hono, type Context } from 'hono';

import { ApiError, readJson } from '../errors.js';
import { loadSession } from '../middleware/session.js';
import {
  createStudyRelayRoom,
  getStudyRelayRoom,
  heartbeatStudyRelayRoom,
  joinStudyRelayRoom,
  requestStudyRelayDrawingUploadUrl,
  startStudyRelayRoom,
  submitStudyRelayDrawing,
  submitStudyRelayExplanation,
} from '../services/study-relay.js';
import type { AppEnv } from '../types.js';
import {
  createStudyRelayRoomSchema,
  joinStudyRelayRoomSchema,
  studyRelayRoomIdSchema,
  submitStudyRelayDrawingSchema,
  submitStudyRelayExplanationSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();

function requirePlayerToken(context: Context<AppEnv>) {
  const header = context.req.header('x-study-relay-token')
    ?? context.req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!header?.trim()) {
    throw new ApiError(401, 'STUDY_RELAY_UNAUTHORIZED', 'A Concept Relay player token is required.');
  }
  return header.trim();
}

api.post('/study-relay/rooms', loadSession, async (context) => {
  const input = createStudyRelayRoomSchema.parse(await readJson(context));
  const user = context.get('user');
  return context.json(await createStudyRelayRoom({
    displayName: input.displayName,
    subject: input.subject,
    ...(input.squadId ? { squadId: input.squadId } : {}),
    userId: user?.id ?? null,
  }), 201);
});

api.post('/study-relay/rooms/join', loadSession, async (context) => {
  const input = joinStudyRelayRoomSchema.parse(await readJson(context));
  const user = context.get('user');
  return context.json(await joinStudyRelayRoom({
    code: input.code,
    displayName: input.displayName,
    userId: user?.id ?? null,
  }), 201);
});

api.get('/study-relay/rooms/:roomId', async (context) => {
  const roomId = studyRelayRoomIdSchema.parse(context.req.param('roomId'));
  const token = requirePlayerToken(context);
  return context.json(await getStudyRelayRoom(roomId, token));
});

api.post('/study-relay/rooms/:roomId/start', async (context) => {
  const roomId = studyRelayRoomIdSchema.parse(context.req.param('roomId'));
  const token = requirePlayerToken(context);
  return context.json(await startStudyRelayRoom(roomId, token));
});

api.post('/study-relay/rooms/:roomId/drawings/upload-url', async (context) => {
  const roomId = studyRelayRoomIdSchema.parse(context.req.param('roomId'));
  const token = requirePlayerToken(context);
  return context.json(await requestStudyRelayDrawingUploadUrl(roomId, token));
});

api.post('/study-relay/rooms/:roomId/submissions/drawing', async (context) => {
  const roomId = studyRelayRoomIdSchema.parse(context.req.param('roomId'));
  const token = requirePlayerToken(context);
  const input = submitStudyRelayDrawingSchema.parse(await readJson(context));
  return context.json(await submitStudyRelayDrawing(roomId, token, input.path));
});

api.post('/study-relay/rooms/:roomId/submissions/explanation', async (context) => {
  const roomId = studyRelayRoomIdSchema.parse(context.req.param('roomId'));
  const token = requirePlayerToken(context);
  const input = submitStudyRelayExplanationSchema.parse(await readJson(context));
  return context.json(await submitStudyRelayExplanation(roomId, token, input.text));
});

api.post('/study-relay/rooms/:roomId/heartbeat', async (context) => {
  const roomId = studyRelayRoomIdSchema.parse(context.req.param('roomId'));
  const token = requirePlayerToken(context);
  return context.json(await heartbeatStudyRelayRoom(roomId, token));
});

export { api as studyRelayApi };
