import { afterEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const headMock = vi.fn();
vi.mock('@vercel/blob', () => ({ list: listMock, head: headMock }));

const requireAdminMock = vi.fn();
vi.mock('../_lib/adminAuth.js', () => ({ requireAdmin: requireAdminMock }));

const originalFetch = global.fetch;
const { GET: handler } = await import('./submissions.js');

const UNAUTHORIZED = {
  ok: false,
  response: Response.json({ error: 'Unauthorized' }, { status: 401 }),
};
const FORBIDDEN = { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
const AUTHORIZED = { ok: true, user: { user: { id: 'admin-1', role: 'admin' } } };

afterEach(() => {
  global.fetch = originalFetch;
  listMock.mockReset();
  headMock.mockReset();
  requireAdminMock.mockReset();
});

describe('GET /api/admin/submissions', () => {
  it('rejects unauthenticated requests with 401', async () => {
    requireAdminMock.mockResolvedValue(UNAUTHORIZED);
    const res = await handler(new Request('http://localhost/api/admin/submissions'));
    expect(res.status).toBe(401);
  });

  it('rejects an authenticated non-admin with 403', async () => {
    requireAdminMock.mockResolvedValue(FORBIDDEN);
    const res = await handler(new Request('http://localhost/api/admin/submissions'));
    expect(res.status).toBe(403);
  });

  it('lists records newest-first for an authorized admin', async () => {
    requireAdminMock.mockResolvedValue(AUTHORIZED);
    listMock.mockResolvedValue({
      blobs: [{ url: 'https://blob.test/a.json' }, { url: 'https://blob.test/b.json' }],
    });
    global.fetch = vi.fn((url: string) =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            id: url.includes('a.json') ? 'a' : 'b',
            createdAt: url.includes('a.json')
              ? '2026-01-01T00:00:00.000Z'
              : '2026-02-01T00:00:00.000Z',
            status: 'pending',
          }),
      }),
    ) as unknown as typeof fetch;

    const res = await handler(new Request('http://localhost/api/admin/submissions'));
    const json = (await res.json()) as { records: { id: string }[]; count: number };
    expect(res.status).toBe(200);
    expect(json.count).toBe(2);
    expect(json.records[0]?.id).toBe('b');
  });

  it('rejects a malformed id when fetching a single record', async () => {
    requireAdminMock.mockResolvedValue(AUTHORIZED);
    const res = await handler(new Request('http://localhost/api/admin/submissions?id=not-a-uuid'));
    expect(res.status).toBe(400);
  });
});
