import { Hono } from 'hono';
import { z } from 'zod';
import { ApiError, readJson } from '../errors.js';
import { loadSession, requireSession } from '../middleware/session.js';
import { listLearningWork, submitLearningWork } from '../services/learning-work.js';
import { getRevisionRoom } from '../services/revision-rooms.js';
import { getSquadQuizRoom } from '../services/squad-quiz.js';
import type { AppEnv } from '../types.js';
import { workInputSchema } from '../work-validation.js';

const api = new Hono<AppEnv>();
api.use('*', loadSession, requireSession);
api.get('/me/learning-work/:kind/:roomId', async (context) => {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in first.');
  const kind = z.enum(['rescue', 'revision']).parse(context.req.param('kind'));
  const roomId = z.uuid().parse(context.req.param('roomId'));
  const room = kind === 'rescue' ? (await getSquadQuizRoom(user.id, roomId)).room : (await getRevisionRoom(user.id, roomId)).room;
  if (!room.hasJoined) throw new ApiError(403, 'WORK_NOT_JOINED', 'Join the room before viewing solutions.');
  // Rescue solutions stay private during play, so another student's answer cannot be copied.
  return context.json({ works: await listLearningWork(kind, roomId, kind === 'rescue' && room.status !== 'finished' ? user.id : undefined) });
});
api.post('/me/learning-work/:kind/:roomId', async (context) => {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in first.');
  const kind = z.enum(['rescue', 'revision']).parse(context.req.param('kind'));
  const roomId = z.uuid().parse(context.req.param('roomId'));
  return context.json(await submitLearningWork(kind, roomId, user.id, workInputSchema.parse(await readJson(context))));
});
export { api as learningWorkApi };
