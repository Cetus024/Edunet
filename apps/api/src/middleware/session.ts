import { createMiddleware } from 'hono/factory';
import { auth } from '../auth.js';
import { ApiError } from '../errors.js';
import { appendSetCookieHeaders } from '../lib/auth-response-headers.js';
import type { AppEnv } from '../types.js';

export const loadSession = createMiddleware<AppEnv>(async (context, next) => {
  const result = await auth.api.getSession({
    headers: context.req.raw.headers,
    returnHeaders: true,
  });
  context.set('user', result.response?.user ?? null);
  context.set('session', result.response?.session ?? null);
  await next();
  appendSetCookieHeaders(result.headers, context.res.headers);
});

export const requireSession = createMiddleware<AppEnv>(async (context, next) => {
  if (!context.get('user') || !context.get('session')) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
  }
  await next();
});
