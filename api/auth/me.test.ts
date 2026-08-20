import { afterEach, describe, expect, it, vi } from 'vitest';

const getSessionUserMock = vi.fn();
vi.mock('../_lib/session.js', () => ({ getSessionUser: getSessionUserMock }));

const { handleMe: handler } = await import('./me.js');

afterEach(() => {
  getSessionUserMock.mockReset();
});

describe('GET /api/auth/me', () => {
  it('returns { user: null } (200, not 401) when signed out', async () => {
    getSessionUserMock.mockResolvedValue(null);
    const res = await handler(new Request('http://localhost/api/auth/me'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { user: unknown };
    expect(json.user).toBeNull();
  });

  it('returns the profile shape when signed in', async () => {
    getSessionUserMock.mockResolvedValue({
      user: {
        id: 'u1',
        x_username: 'ada',
        display_name: 'Ada',
        avatar_url: 'https://x.test/a.jpg',
        bio: 'hi',
        role: 'user',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    });
    const res = await handler(new Request('http://localhost/api/auth/me'));
    const json = (await res.json()) as { user: { xUsername: string; displayName: string } };
    expect(json.user.xUsername).toBe('ada');
    expect(json.user.displayName).toBe('Ada');
  });
});
