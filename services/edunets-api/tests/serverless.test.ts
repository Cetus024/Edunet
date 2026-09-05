import { describe, expect, it, vi } from 'vitest';

import { createServerlessHandler } from '../../../api/serverless.js';

describe('Vercel serverless entry', () => {
  it('answers health checks without initializing the API', async () => {
    const initialize = vi.fn();
    const handler = createServerlessHandler({ initialize });

    const response = await handler.fetch(new Request('https://edunet-two.vercel.app/api/health'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
    expect(initialize).not.toHaveBeenCalled();
  });

  it('returns a stable configuration error when initialization fails', async () => {
    const reportInitializationFailure = vi.fn();
    const handler = createServerlessHandler({
      initialize: vi.fn().mockRejectedValue(new Error('secret connection detail')),
      reportInitializationFailure,
    });

    const response = await handler.fetch(new Request('https://edunet-two.vercel.app/api/v1/me'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'API_CONFIGURATION_INVALID',
        message: 'The API is not configured correctly.',
      },
    });
    expect(reportInitializationFailure).toHaveBeenCalledOnce();
  });

  it('returns NOT_READY when the database readiness check fails', async () => {
    const handler = createServerlessHandler({
      initialize: vi.fn().mockResolvedValue({
        fetch: vi.fn(),
        checkReadiness: vi.fn().mockRejectedValue(new Error('database unavailable')),
      }),
    });

    const response = await handler.fetch(new Request('https://edunet-two.vercel.app/api/ready'));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'NOT_READY',
        message: 'The service is not ready.',
      },
    });
  });

  it('forwards business requests after a successful initialization', async () => {
    const expected = new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), {
      status: 401,
    });
    const fetch = vi.fn().mockResolvedValue(expected);
    const handler = createServerlessHandler({
      initialize: vi.fn().mockResolvedValue({
        fetch,
        checkReadiness: vi.fn().mockResolvedValue(undefined),
      }),
    });
    const request = new Request('https://edunet-two.vercel.app/api/v1/me');

    const response = await handler.fetch(request);

    expect(response).toBe(expected);
    expect(fetch).toHaveBeenCalledWith(request);
  });
});
