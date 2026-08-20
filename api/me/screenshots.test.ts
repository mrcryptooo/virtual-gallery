import { afterEach, describe, expect, it, vi } from 'vitest';

const getSessionUserMock = vi.fn();
vi.mock('../_lib/_session.js', () => ({ getSessionUser: getSessionUserMock }));

const listMock = vi.fn();
vi.mock('@vercel/blob', () => ({ list: listMock }));

const originalFetch = global.fetch;
const { GET: handler } = await import('./screenshots.js');

afterEach(() => {
  getSessionUserMock.mockReset();
  listMock.mockReset();
  global.fetch = originalFetch;
});

describe('GET /api/me/screenshots', () => {
  it('rejects unauthenticated requests', async () => {
    getSessionUserMock.mockResolvedValue(null);
    const res = await handler(new Request('http://localhost/api/me/screenshots'));
    expect(res.status).toBe(401);
  });

  it("only returns screenshots owned by the signed-in user, never someone else's", async () => {
    getSessionUserMock.mockResolvedValue({ user: { id: 'u1' } });
    listMock.mockResolvedValue({
      blobs: [{ url: 'https://blob.test/a.json' }, { url: 'https://blob.test/b.json' }],
    });
    global.fetch = vi.fn((url: string) =>
      Promise.resolve({
        json: () =>
          Promise.resolve(
            url.includes('a.json')
              ? { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', userId: 'u1' }
              : { id: 'b', createdAt: '2026-01-02T00:00:00.000Z', userId: 'someone-else' },
          ),
      }),
    ) as unknown as typeof fetch;

    const res = await handler(new Request('http://localhost/api/me/screenshots'));
    const json = (await res.json()) as { screenshots: { id: string }[]; count: number };
    expect(res.status).toBe(200);
    expect(json.count).toBe(1);
    expect(json.screenshots[0]?.id).toBe('a');
  });
});
