import { afterEach, describe, expect, it, vi } from 'vitest';

const { GET: handler } = await import('./[action].js');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/auth/[action]', () => {
  it('dispatches "login" to handleLogin', async () => {
    vi.stubEnv('X_CLIENT_ID', '');
    const res = await handler(new Request('https://seismic-museum.vercel.app/api/auth/login'));
    // handleLogin's own "not configured" branch -- proves this request
    // actually reached it rather than falling through to the 404 default.
    expect(res.status).toBe(503);
  });

  it('dispatches "me" to handleMe', async () => {
    const res = await handler(new Request('https://seismic-museum.vercel.app/api/auth/me'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: null });
  });

  it('returns 404 for an unrecognized action', async () => {
    const res = await handler(
      new Request('https://seismic-museum.vercel.app/api/auth/not-a-real-action'),
    );
    expect(res.status).toBe(404);
  });
});
