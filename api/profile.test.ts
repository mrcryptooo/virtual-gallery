import { afterEach, describe, expect, it, vi } from 'vitest';

const getSessionUserMock = vi.fn();
vi.mock('./_lib/session.js', () => ({ getSessionUser: getSessionUserMock }));

const fromMock = vi.fn();
vi.mock('./_lib/supabase.js', () => ({ getSupabase: () => ({ from: fromMock }) }));

const { PATCH: handler } = await import('./profile.js');

function req(body: unknown): Request {
  return new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  getSessionUserMock.mockReset();
  fromMock.mockReset();
});

describe('PATCH /api/profile', () => {
  it('rejects unauthenticated requests', async () => {
    getSessionUserMock.mockResolvedValue(null);
    const res = await handler(req({ displayName: 'Ada' }));
    expect(res.status).toBe(401);
  });

  it('rejects a missing display name', async () => {
    getSessionUserMock.mockResolvedValue({ user: { id: 'u1' } });
    const res = await handler(req({ displayName: '' }));
    expect(res.status).toBe(400);
  });

  it("updates the signed-in user's own row, never a client-supplied id", async () => {
    getSessionUserMock.mockResolvedValue({ user: { id: 'u1' } });
    let updatedId: string | undefined;
    fromMock.mockReturnValue({
      update: () => ({
        eq: (col: string, value: string) => {
          updatedId = value;
          return Promise.resolve({ error: null });
        },
      }),
    });

    const res = await handler(req({ displayName: 'Ada', bio: 'hi', id: 'someone-elses-id' }));
    expect(res.status).toBe(200);
    expect(updatedId).toBe('u1');
  });
});
