import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type RequestVariables = {
  requestId: string;
};

export function errorResponse<Variables extends RequestVariables>(
  context: Context<{ Variables: Variables }>,
  status: ContentfulStatusCode,
  code: string,
  message: string,
): Response {
  return context.json(
    {
      error: {
        code,
        message,
        requestId: context.get('requestId'),
      },
    },
    status,
  );
}

export function handleError<Variables extends RequestVariables>(
  error: unknown,
  context: Context<{ Variables: Variables }>,
): Response {
  if (error instanceof ApiError) {
    return errorResponse(context, error.status, error.code, error.message);
  }

  if (error instanceof ZodError) {
    return errorResponse(context, 400, 'INVALID_REQUEST', 'Request validation failed.');
  }

  // Never serialize database errors, stack traces, connection details, or the
  // offending request. The request ID is enough to correlate server logs.
  console.error(JSON.stringify({
    level: 'error',
    requestId: context.get('requestId'),
    method: context.req.method,
    path: context.req.path,
    errorType: error instanceof Error ? error.name : 'UnknownError',
  }));

  return errorResponse(context, 500, 'INTERNAL_ERROR', 'An unexpected error occurred.');
}

export async function readJson(context: Context): Promise<unknown> {
  try {
    return await context.req.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Request body must contain valid JSON.');
  }
}
