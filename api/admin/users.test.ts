import { afterEach, describe, expect, it, vi } from 'vitest';

const requireAdminMock = vi.fn();
vi.mock('../_lib/_adminAuth.js', () => ({ requireAdmin: requireAdminMock }));

const fromMock = vi.fn();
vi.mock('../_lib/_supabase.js', () => ({ getSupabase: () => ({ from: fromMock }) }));

const { handleUsers: handler } = await import('./_users.js');

const UNAUTHORIZED = {
  ok: false,
  response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
};
const AUTHORIZED = { ok: true, user: { user: { id: 'admin-1', role: 'admin' } } };

afterEach(() => {
  requireAdminMock.mockReset();
  fromMock.mockReset();
});

describe('GET /api/admin/users', () => {
  it('rejects unauthenticated requests', async () => {
    requireAdminMock.mockResolvedValue(UNAUTHORIZED);
    const res = await handler(new Request('http://localhost/api/admin/users'));
    expect(res.status).toBe(401);
  });

  it('lists users for an authorized admin', async () => {
    requireAdminMock.mockResolvedValue(AUTHORIZED);
    fromMock.mockReturnValue({
      select: () => ({
        order: () => ({
          limit: () => ({
            overrideTypes: () =>
              Promise.resolve({
                data: [{ id: 'u1', role: 'user' }],
                error: null,
              }),
          }),
        }),
      }),
    });

    const res = await handler(new Request('http://localhost/api/admin/users'));
    const json = (await res.json()) as { users: { id: string }[]; count: number };
    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
    expect(json.users[0]?.id).toBe('u1');
  });
});
