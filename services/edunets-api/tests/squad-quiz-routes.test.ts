import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { ApiError, handleError } from '../src/errors.js';
import type { AppEnv } from '../src/types.js';

vi.mock('../src/services/squad-quiz.js', () => ({
  advanceSquadQuizRoom: vi.fn(),
  createSquadQuizRoom: vi.fn(),
  getSquadQuizRoom: vi.fn(),
  heartbeatSquadQuizRoom: vi.fn(),
  inviteSquadQuizParticipants: vi.fn(),
  joinSquadQuizRoom: vi.fn(),
  restartSquadQuizRoom: vi.fn(),
}));

vi.mock('../src/middleware/session.js', () => ({
  loadSession: async (
    context: {
      req: { header: (name: string) => string | undefined };
      set: (name: string, value: unknown) => void;
    },
    next: () => Promise<void>,
  ) => {
    context.set('requestId', 'squad-quiz-route-test');
    if (context.req.header('x-test-user')) {
      context.set('user', { id: 'student-a', name: 'Student A' });
      context.set('session', { id: 'session-a' });
    }
    await next();
  },
  requireSession: async (
    context: { get: (name: string) => unknown },
    next: () => Promise<void>,
  ) => {
    if (!context.get('user') || !context.get('session')) {
      throw new ApiError(401, 'UNAUTHORIZED', 'Authentication is required.');
    }
    await next();
  },
}));

import { squadQuizApi } from '../src/routes/squad-quiz.js';

const app = new Hono<AppEnv>().route('/api/v1', squadQuizApi);
app.onError(handleError);

const roomId = '68f2a182-3d01-46b8-925c-da33882ca98e';
const path = `/api/v1/me/squad-quiz-rooms/${roomId}/answers`;

describe('legacy Squad quiz answer compatibility', () => {
  it('still requires an authenticated session', async () => {
    const response = await app.request(path, { method: 'POST' });
    expect(response.status).toBe(401);
  });

  it('directs authenticated legacy clients to the handwritten solution flow', async () => {
    const response = await app.request(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-test-user': 'student-a',
      },
      body: JSON.stringify({ questionIndex: 2, answer: 1 }),
    });

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'USE_HANDWRITTEN_SOLUTION' },
    });
  });
});
