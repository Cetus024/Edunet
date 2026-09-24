import { Hono, type Context } from 'hono';

import { ApiError, readJson } from '../errors.js';
import { loadSession, requireSession } from '../middleware/session.js';
import {
  acceptStudySquadInvitation,
  acceptInAppStudySquadInvitation,
  createStudySquad,
  declineInAppStudySquadInvitation,
  getSchoolDirectory,
  getStudySquad,
  getStudySquadInvitation,
  inviteToStudySquad,
  inviteSchoolUserToStudySquad,
  restoreStudySquadStreak,
} from '../services/study-squads.js';
import type { AppEnv } from '../types.js';
import {
  createStudySquadSchema,
  inviteToStudySquadSchema,
  inviteSchoolUserToStudySquadSchema,
  studySquadInvitationIdSchema,
  studySquadInvitationTokenSchema,
} from '../validation.js';

const api = new Hono<AppEnv>();

function requireUser(context: Context<AppEnv>) {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user;
}

api.get('/me/study-squad', loadSession, requireSession, async (context) => {
  return context.json(await getStudySquad(requireUser(context).id));
});

api.get('/me/school-directory', loadSession, requireSession, async (context) => {
  return context.json(await getSchoolDirectory(requireUser(context).id));
});

api.post('/me/study-squad', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const input = createStudySquadSchema.parse(await readJson(context));
  return context.json(await createStudySquad(user.id, input.name), 201);
});

api.post('/me/study-squad/invitations', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const input = inviteToStudySquadSchema.parse(await readJson(context));
  const invitation = await inviteToStudySquad(user.id, user.name, user.email, input.email);
  return context.json({ invitation }, 201);
});

api.post('/me/study-squad/invitations/in-app', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const input = inviteSchoolUserToStudySquadSchema.parse(await readJson(context));
  return context.json({ invitation: await inviteSchoolUserToStudySquad(user.id, input.userId) }, 201);
});

api.post('/me/study-squad/invitations/:invitationId/accept', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const invitationId = studySquadInvitationIdSchema.parse(context.req.param('invitationId'));
  return context.json(await acceptInAppStudySquadInvitation(user.id, user.name, invitationId));
});

api.post('/me/study-squad/invitations/:invitationId/decline', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const invitationId = studySquadInvitationIdSchema.parse(context.req.param('invitationId'));
  return context.json(await declineInAppStudySquadInvitation(user.id, user.name, invitationId));
});

api.post('/me/study-squad/streak/restore', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  return context.json(await restoreStudySquadStreak(user.id, user.name));
});

api.get('/study-squad-invitations/:token', async (context) => {
  const token = studySquadInvitationTokenSchema.parse(context.req.param('token'));
  return context.json({ invitation: await getStudySquadInvitation(token) });
});

api.post('/study-squad-invitations/:token/accept', loadSession, requireSession, async (context) => {
  const user = requireUser(context);
  const token = studySquadInvitationTokenSchema.parse(context.req.param('token'));
  return context.json(await acceptStudySquadInvitation(user.id, user.name, user.email, token));
});

export { api as studySquadsApi };
