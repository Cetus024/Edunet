const DEFAULT_API_BASE_URL = 'http://localhost:8787';

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export const API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_EDUNETS_API_URL || DEFAULT_API_BASE_URL,
);

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor({
    message,
    status,
    code,
    requestId,
  }: {
    message: string;
    status: number;
    code: string;
    requestId?: string;
  }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

export class ApiConnectionError extends Error {
  readonly code = 'API_UNAVAILABLE';

  constructor() {
    super('EduNets could not reach the account service. Check that the API is running and try again.');
    this.name = 'ApiConnectionError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function createApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  try {
    response = await fetch(createApiUrl(path), {
      ...init,
      credentials: 'include',
      headers,
    });
  } catch {
    throw new ApiConnectionError();
  }

  const payload = await readJson(response);

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload | null;
    throw new ApiError({
      status: response.status,
      code: errorPayload?.error?.code ?? 'API_REQUEST_FAILED',
      message:
        errorPayload?.error?.message ??
        `EduNets could not complete this request (${response.status}).`,
      requestId: errorPayload?.error?.requestId,
    });
  }

  return payload as T;
}
