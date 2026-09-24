import { Hono, type Context } from 'hono';

import { ApiError } from '../errors.js';
import { loadSession, requireSession } from '../middleware/session.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.js';
import type { AppEnv } from '../types.js';
import { notificationIdSchema, notificationsQuerySchema } from '../validation.js';

const api = new Hono<AppEnv>();

function requireUserId(context: Context<AppEnv>): string {
  const user = context.get('user');
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  return user.id;
}

api.get('/me/notifications', loadSession, requireSession, async (context) => {
  const query = notificationsQuerySchema.parse(context.req.query());
  return context.json(await listNotifications(requireUserId(context), query.limit));
});

api.put('/me/notifications/read-all', loadSession, requireSession, async (context) => {
  return context.json(await markAllNotificationsRead(requireUserId(context)));
});

api.put('/me/notifications/:notificationId/read', loadSession, requireSession, async (context) => {
  const notificationId = notificationIdSchema.parse(context.req.param('notificationId'));
  return context.json(await markNotificationRead(requireUserId(context), notificationId));
});

export { api as notificationsApi };
