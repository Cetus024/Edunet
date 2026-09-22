import { randomUUID } from 'node:crypto';
import { cors } from 'hono/cors';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { ApiError } from '../errors.js';
import { env } from '../env.js';
import type { AppEnv } from '../types.js';

const acceptedRequestId = /^[A-Za-z0-9._:-]{1,128}$/;
const allowedOrigins = new Set(env.corsOrigins);

export const requestContext = createMiddleware<AppEnv>(async (context, next) => {
  const supplied = context.req.header('x-request-id');
  const requestId = supplied && acceptedRequestId.test(supplied) ? supplied : randomUUID();
  const startedAt = performance.now();
  context.set('requestId', requestId);

  await next();

  context.header('x-request-id', requestId);
  console.info(JSON.stringify({
    level: 'info',
    requestId,
    method: context.req.method,
    path: context.req.path,
    status: context.res.status,
    durationMs: Math.round(performance.now() - startedAt),
  }));
});

export const exactOriginGuard = createMiddleware<AppEnv>(async (context, next) => {
  const origin = context.req.header('origin');
  if (origin && !allowedOrigins.has(origin)) {
    throw new ApiError(403, 'ORIGIN_NOT_ALLOWED', 'Request origin is not allowed.');
  }
  await next();
});

export const corsMiddleware = cors({
  origin: (origin) => allowedOrigins.has(origin) ? origin : '',
  allowHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  exposeHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 600,
  credentials: true,
});

export const securityHeaders = secureHeaders({
  crossOriginResourcePolicy: 'same-site',
  referrerPolicy: 'no-referrer',
  xContentTypeOptions: 'nosniff',
  xFrameOptions: 'DENY',
});
