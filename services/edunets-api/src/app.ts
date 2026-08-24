import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { pool } from '../../../database/index.js';
import { auth } from './auth.js';
import { ApiError, errorResponse, handleError } from './errors.js';
import { appendSafeAuthErrorHeaders } from './lib/auth-response-headers.js';
import {
  corsMiddleware,
  exactOriginGuard,
  requestContext,
  securityHeaders,
} from './middleware/request-context.js';
import type { AppEnv } from './types.js';
import { apiV1 } from './routes/api-v1.js';
import { enquiriesApi } from './routes/enquiries.js';

const app = new Hono<AppEnv>({ strict: false });

app.use('*', requestContext);
app.use('*', bodyLimit({
  maxSize: 1024 * 1024,
  onError: (context) => errorResponse(
    context,
    413,
    'PAYLOAD_TOO_LARGE',
    'Request body must not exceed 1 MiB.',
  ),
}));
app.use('*', exactOriginGuard);
app.use('*', corsMiddleware);
app.use('*', securityHeaders);

app.get('/health', (context) => context.json({ status: 'ok' }));

app.get('/ready', async (context) => {
  try {
    await Promise.race([
      pool.query('select 1'),
      new Promise<never>((_resolve, reject) => {
        setTimeout(() => reject(new Error('Readiness check timed out')), 3_000).unref();
      }),
    ]);
    return context.json({ status: 'ready' });
  } catch {
    throw new ApiError(503, 'NOT_READY', 'The service is not ready.');
  }
});

app.on(['GET', 'POST'], '/api/auth/*', async (context) => {
  const response = await auth.handler(context.req.raw);
  if (response.status < 400) return response;

  let payload: unknown;
  try {
    payload = await response.clone().json();
  } catch {
    payload = null;
  }

  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : null;
  const nestedError = record?.error && typeof record.error === 'object'
    ? record.error as Record<string, unknown>
    : null;
  const codeValue = nestedError?.code ?? record?.code;
  const messageValue = nestedError?.message ?? record?.message;
  const status = response.status as ContentfulStatusCode;
  const code = typeof codeValue === 'string' && /^[A-Z0-9_]{1,80}$/.test(codeValue)
    ? codeValue
    : 'AUTH_REQUEST_FAILED';
  const message = response.status < 500 && typeof messageValue === 'string' && messageValue.length <= 300
    ? messageValue
    : response.status < 500 ? 'Authentication request failed.' : 'Authentication service failed.';

  const normalizedResponse = errorResponse(context, status, code, message);
  appendSafeAuthErrorHeaders(response.headers, normalizedResponse.headers);
  return normalizedResponse;
});

app.route('/api/v1', apiV1);
app.route('/api/v1', enquiriesApi);

app.notFound((context) => errorResponse(context, 404, 'NOT_FOUND', 'Route not found.'));
app.onError(handleError);

export { app };
export type AppType = typeof app;
