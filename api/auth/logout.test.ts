import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeSessionCookieValue } from '../_lib/session.js';

const { revokeSessionMock } = vi.hoisted(() => ({
  revokeSessionMock: vi.fn(() => Promise.resolve()),
}));
vi.mock('../_lib/session.js', async () => {
  const actual = await vi.importActual<typeof import('../_lib/session.js')>('../_lib/session.js');
  return { ...actual, revokeSession: revokeSessionMock };
});

const { handleLogout: handler } = await import('./logout.js');

afterEach(() => {
  vi.unstubAllEnvs();
  revokeSessionMock.mockClear();
});

describe('GET /api/auth/logout', () => {
  it('revokes the real session and clears the cookie', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const cookie = encodeSessionCookieValue('session-1');
    const res = await handler(
      new Request('http://localhost/api/auth/logout', {
        headers: { cookie: `seismic_session=${cookie}` },
      }),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/');
    expect(revokeSessionMock).toHaveBeenCalledWith('session-1');
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });

  it('does not call revokeSession for a tampered cookie', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const res = await handler(
      new Request('http://localhost/api/auth/logout', {
        headers: { cookie: 'seismic_session=garbage' },
      }),
    );
    expect(res.status).toBe(302);
    expect(revokeSessionMock).not.toHaveBeenCalled();
  });

  it('succeeds cleanly with no session cookie at all', async () => {
    const res = await handler(new Request('http://localhost/api/auth/logout'));
    expect(res.status).toBe(302);
    expect(revokeSessionMock).not.toHaveBeenCalled();
  });
});
