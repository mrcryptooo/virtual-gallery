import { afterEach, describe, expect, it, vi } from 'vitest';

const listMock = vi.fn();
const headMock = vi.fn();
vi.mock('@vercel/blob', () => ({ list: listMock, head: headMock }));

const originalFetch = global.fetch;
const { GET: handler } = await import('./submissions.js');

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  listMock.mockReset();
  headMock.mockReset();
});

describe('GET /api/admin/submissions', () => {
  it('fails closed with no token configured', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', '');
    const res = await handler(
      new Request('http://localhost/api/admin/submissions', {
        headers: { authorization: 'Bearer anything' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects requests with no Authorization header', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', 'secret');
    const res = await handler(new Request('http://localhost/api/admin/submissions'));
    expect(res.status).toBe(401);
  });

  it('rejects requests with the wrong token', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', 'secret');
    const res = await handler(
      new Request('http://localhost/api/admin/submissions', {
        headers: { authorization: 'Bearer wrong' },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('lists records newest-first when authorized', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', 'secret');
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

    const res = await handler(
      new Request('http://localhost/api/admin/submissions', {
        headers: { authorization: 'Bearer secret' },
      }),
    );
    const json = (await res.json()) as { records: { id: string }[]; count: number };
    expect(res.status).toBe(200);
    expect(json.count).toBe(2);
    expect(json.records[0]?.id).toBe('b');
  });

  it('rejects a malformed id when fetching a single record', async () => {
    vi.stubEnv('ADMIN_API_TOKEN', 'secret');
    const res = await handler(
      new Request('http://localhost/api/admin/submissions?id=not-a-uuid', {
        headers: { authorization: 'Bearer secret' },
      }),
    );
    expect(res.status).toBe(400);
  });
});
