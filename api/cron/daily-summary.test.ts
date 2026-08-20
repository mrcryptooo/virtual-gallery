import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';

const listMock: Mock = vi.fn();
const putMock: Mock = vi.fn(() => Promise.resolve({ url: 'https://blob.test/marker.json' }));
vi.mock('@vercel/blob', () => ({ list: listMock, put: putMock }));

const sendTelegramMessageMock: Mock = vi.fn(() => Promise.resolve(true));
vi.mock('../_lib/_telegram.js', () => ({ sendTelegramMessage: sendTelegramMessageMock }));

const { GET: handler } = await import('./daily-summary.js');

const originalFetch = global.fetch;
const TODAY = new Date().toISOString().slice(0, 10);

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/daily-summary', { headers });
}

function recordFetch(records: Record<string, unknown>[]) {
  let i = 0;
  global.fetch = vi.fn(() => {
    const record = records[i];
    i += 1;
    return Promise.resolve({ json: () => Promise.resolve(record) });
  }) as unknown as typeof fetch;
}

afterEach(() => {
  vi.unstubAllEnvs();
  global.fetch = originalFetch;
  listMock.mockReset();
  putMock.mockClear();
  sendTelegramMessageMock.mockReset();
  sendTelegramMessageMock.mockResolvedValue(true);
});

describe('GET /api/cron/daily-summary', () => {
  it('fails closed with no CRON_SECRET configured', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await handler(req({ authorization: 'Bearer anything' }));
    expect(res.status).toBe(401);
  });

  it('rejects a request with the wrong bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    const res = await handler(req({ authorization: 'Bearer wrong' }));
    expect(res.status).toBe(401);
  });

  it('skips and does not send when a marker already exists for today', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    listMock.mockResolvedValueOnce({ blobs: [{ url: 'https://blob.test/marker.json' }] });

    const res = await handler(req({ authorization: 'Bearer secret' }));
    const json = (await res.json()) as { ok: boolean; skipped: boolean };
    expect(res.status).toBe(200);
    expect(json.skipped).toBe(true);
    expect(sendTelegramMessageMock).not.toHaveBeenCalled();
  });

  it("aggregates today's records, sends the digest, and writes the marker", async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    listMock
      .mockResolvedValueOnce({ blobs: [] }) // marker check: none yet
      .mockResolvedValueOnce({ blobs: [{ url: 'https://blob.test/s1.json' }] }) // submissions
      .mockResolvedValueOnce({
        blobs: [{ url: 'https://blob.test/sc1.json' }, { url: 'https://blob.test/sc2.json' }],
      }); // screenshots

    recordFetch([
      { id: 's1', createdAt: `${TODAY}T10:00:00.000Z`, artistName: 'Ada' },
      { id: 'sc1', createdAt: `${TODAY}T09:00:00.000Z`, panoramaId: '0-01' },
      { id: 'sc2', createdAt: `${TODAY}T11:00:00.000Z`, panoramaId: '0-01' },
    ]);

    const res = await handler(req({ authorization: 'Bearer secret' }));
    const json = (await res.json()) as {
      ok: boolean;
      sent: boolean;
      summary: { submissions: number; screenshots: number; topPanorama: string };
    };
    expect(res.status).toBe(200);
    expect(json.sent).toBe(true);
    expect(json.summary.submissions).toBe(1);
    expect(json.summary.screenshots).toBe(2);
    expect(json.summary.topPanorama).toBe('0-01');
    expect(sendTelegramMessageMock).toHaveBeenCalledTimes(1);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0]?.[0]).toBe(`cron/daily-summary/${TODAY}.json`);
  });

  it('excludes records from other dates', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    listMock
      .mockResolvedValueOnce({ blobs: [] })
      .mockResolvedValueOnce({ blobs: [{ url: 'https://blob.test/s1.json' }] })
      .mockResolvedValueOnce({ blobs: [] });

    recordFetch([{ id: 's1', createdAt: '2020-01-01T00:00:00.000Z', artistName: 'Old' }]);

    const res = await handler(req({ authorization: 'Bearer secret' }));
    const json = (await res.json()) as { summary: { submissions: number } };
    expect(json.summary.submissions).toBe(0);
  });

  it('still computes and marks the day done when Telegram is not configured', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    sendTelegramMessageMock.mockResolvedValue(false);
    listMock
      .mockResolvedValueOnce({ blobs: [] })
      .mockResolvedValueOnce({ blobs: [] })
      .mockResolvedValueOnce({ blobs: [] });

    const res = await handler(req({ authorization: 'Bearer secret' }));
    const json = (await res.json()) as { ok: boolean; sent: boolean };
    expect(res.status).toBe(200);
    expect(json.sent).toBe(false);
    expect(putMock).toHaveBeenCalledTimes(1);
  });

  it('returns 502 and does not write a marker when the Telegram send throws', async () => {
    vi.stubEnv('CRON_SECRET', 'secret');
    sendTelegramMessageMock.mockRejectedValue(new Error('Telegram API responded 500'));
    listMock
      .mockResolvedValueOnce({ blobs: [] })
      .mockResolvedValueOnce({ blobs: [] })
      .mockResolvedValueOnce({ blobs: [] });

    const res = await handler(req({ authorization: 'Bearer secret' }));
    expect(res.status).toBe(502);
    expect(putMock).not.toHaveBeenCalled();
  });
});
