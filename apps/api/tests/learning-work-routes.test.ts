import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../src/types.js';
import { ApiError, handleError } from '../src/errors.js';

const mocks = vi.hoisted(() => ({ getRescue: vi.fn(), getRevision: vi.fn(), list: vi.fn(), submit: vi.fn() }));
vi.mock('../src/services/squad-quiz.js', () => ({ getSquadQuizRoom: mocks.getRescue }));
vi.mock('../src/services/revision-rooms.js', () => ({ getRevisionRoom: mocks.getRevision }));
vi.mock('../src/services/learning-work.js', () => ({ listLearningWork: mocks.list, submitLearningWork: mocks.submit }));
vi.mock('../src/middleware/session.js', () => ({
  loadSession: async (context: { req: { header: (name: string) => string }; set: (name: string, value: unknown) => void }, next: () => Promise<void>) => {
    if (context.req.header('x-test-user')) context.set('user', { id: 'student-a', name: 'Student A' });
    await next();
  },
  requireSession: async (context: { get: (name: string) => unknown }, next: () => Promise<void>) => {
    if (!context.get('user')) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in first.');
    await next();
  },
}));
import { learningWorkApi } from '../src/routes/learning-work.js';
const app = new Hono<AppEnv>().route('/api/v1', learningWorkApi);
app.onError(handleError);
const roomId = '68f2a182-3d01-46b8-925c-da33882ca98e';
const headers = { 'x-test-user': 'student-a', 'Content-Type': 'application/json' };

beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue([]); mocks.getRescue.mockResolvedValue({ room: { hasJoined: true, status: 'active' } }); mocks.getRevision.mockResolvedValue({ room: { hasJoined: true, status: 'live' } }); });
describe('learning work room boundaries', () => {
  it('requires authentication before reading solutions', async () => {
    expect((await app.request(`/api/v1/me/learning-work/rescue/${roomId}`)).status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('does not expose another student work during rescue play', async () => {
    expect((await app.request(`/api/v1/me/learning-work/rescue/${roomId}`, { headers })).status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith('rescue', roomId, 'student-a');
  });
  it('shares completed rescue work only after room access and joining are checked', async () => {
    mocks.getRescue.mockResolvedValue({ room: { hasJoined: true, status: 'finished' } });
    await app.request(`/api/v1/me/learning-work/rescue/${roomId}`, { headers });
    expect(mocks.list).toHaveBeenCalledWith('rescue', roomId, undefined);
    mocks.getRescue.mockResolvedValue({ room: { hasJoined: false, status: 'finished' } });
    mocks.list.mockClear();
    expect((await app.request(`/api/v1/me/learning-work/rescue/${roomId}`, { headers })).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('denies cross-squad access before querying saved work', async () => {
    mocks.getRevision.mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Wrong squad'));
    expect((await app.request(`/api/v1/me/learning-work/revision/${roomId}`, { headers })).status).toBe(403);
    expect(mocks.list).not.toHaveBeenCalled();
  });
  it('rejects invalid submissions before calling the model service', async () => {
    const response = await app.request(`/api/v1/me/learning-work/rescue/${roomId}`, { method: 'POST', headers, body: JSON.stringify({ transcript: 'x = 3' }) });
    expect(response.status).toBe(400);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
