type ServerlessRuntime = {
  fetch: (request: Request) => Response | Promise<Response>;
  checkReadiness: () => Promise<unknown>;
};

type ServerlessHandlerOptions = {
  initialize: () => Promise<ServerlessRuntime>;
  readinessTimeoutMilliseconds?: number;
  reportInitializationFailure?: () => void;
};

type InitializationStage =
  | 'configuration'
  | 'database-module'
  | 'application-module'
  | 'pool-attachment';

export class ServerlessInitializationError extends Error {
  constructor(
    readonly stage: InitializationStage,
    readonly invalidVariables: readonly string[],
    options?: ErrorOptions,
  ) {
    super('The serverless API could not initialize.', options);
    this.name = 'ServerlessInitializationError';
  }
}

const JSON_HEADERS = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=UTF-8',
} as const;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
}

function errorResponse(
  code: 'API_CONFIGURATION_INVALID' | 'NOT_READY',
  message: string,
  initializationError?: ServerlessInitializationError,
): Response {
  const response = jsonResponse({ error: { code, message } }, 503);
  if (initializationError) {
    response.headers.set('x-edunets-initialization-stage', initializationError.stage);
    if (initializationError.invalidVariables.length > 0) {
      response.headers.set(
        'x-edunets-invalid-variables',
        initializationError.invalidVariables.join(','),
      );
    }
  }
  return response;
}

function isEndpoint(request: Request, endpoint: 'health' | 'ready'): boolean {
  if (request.method !== 'GET') return false;
  const pathname = new URL(request.url).pathname.replace(/\/+$/, '') || '/';
  return pathname === `/api/${endpoint}` || pathname === `/${endpoint}`;
}

async function runWithTimeout(
  operation: () => Promise<unknown>,
  timeoutMilliseconds: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('Readiness check timed out')), timeoutMilliseconds);
        timeout.unref?.();
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export function createServerlessHandler(options: ServerlessHandlerOptions): {
  fetch: (request: Request) => Promise<Response>;
} {
  const readinessTimeoutMilliseconds = options.readinessTimeoutMilliseconds ?? 3_000;
  let runtimePromise: Promise<ServerlessRuntime> | undefined;
  let initializationError: ServerlessInitializationError | undefined;

  const initialize = (): Promise<ServerlessRuntime> => {
    if (!runtimePromise) {
      runtimePromise = options.initialize().catch((error: unknown) => {
        initializationError = error instanceof ServerlessInitializationError
          ? error
          : undefined;
        (options.reportInitializationFailure ?? (() => {
          console.error(JSON.stringify({
            level: 'error',
            event: 'serverless-initialization-failed',
            errorType: error instanceof Error ? error.name : 'UnknownError',
          }));
        }))();
        throw error;
      });
    }
    return runtimePromise;
  };

  return {
    async fetch(request: Request): Promise<Response> {
      if (isEndpoint(request, 'health')) {
        return jsonResponse({ status: 'ok' });
      }

      let runtime: ServerlessRuntime;
      try {
        runtime = await initialize();
      } catch {
        return errorResponse(
          'API_CONFIGURATION_INVALID',
          'The API is not configured correctly.',
          initializationError,
        );
      }

      if (isEndpoint(request, 'ready')) {
        try {
          await runWithTimeout(runtime.checkReadiness, readinessTimeoutMilliseconds);
          return jsonResponse({ status: 'ready' });
        } catch {
          return errorResponse('NOT_READY', 'The service is not ready.');
        }
      }

      return runtime.fetch(request);
    },
  };
}
