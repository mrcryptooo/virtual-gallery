import { afterEach, describe, expect, it, vi } from 'vitest';

const getSessionUserMock = vi.fn();
vi.mock('./_session.js', () => ({ getSessionUser: getSessionUserMock }));

const { requireAdmin } = await import('./_adminAuth.js');

afterEach(() => {
  getSessionUserMock.mockReset();
});

describe('requireAdmin', () => {
  it('returns 401 for an unauthenticated (no session) request', async () => {
    getSessionUserMock.mockResolvedValue(null);
    const result = await requireAdmin(new Request('http://localhost/'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('returns 403 for an authenticated non-admin user', async () => {
    getSessionUserMock.mockResolvedValue({ user: { role: 'user' } });
    const result = await requireAdmin(new Request('http://localhost/'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('returns ok for an authenticated admin user', async () => {
    getSessionUserMock.mockResolvedValue({ user: { role: 'admin' } });
    const result = await requireAdmin(new Request('http://localhost/'));
    expect(result.ok).toBe(true);
  });
});
