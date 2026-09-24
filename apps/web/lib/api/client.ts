// Falls back to current origin in browser (same-domain API on Vercel), or localhost for dev
const DEFAULT_API_BASE_URL =
  typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8787';

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

/**
 * The chosen language, read straight from the store jotai's atomWithStorage
 * writes to.
 *
 * apiRequest is a plain function called from query functions rather than from
 * a component, so it cannot use the locale hook. Reading the key directly keeps
 * every request carrying the language without threading a locale argument
 * through every call site. Storage can throw outright in a private window or
 * when site data is blocked, so a failure here degrades to English rather than
 * breaking the request.
 */
function currentLocaleHeader(): string {
  try {
    const stored = globalThis.localStorage?.getItem('edunets-locale');
    return stored && JSON.parse(stored) === 'zh' ? 'zh-CN' : 'en-SG';
  } catch {
    return 'en-SG';
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (!headers.has('Accept-Language')) headers.set('Accept-Language', currentLocaleHeader());

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
