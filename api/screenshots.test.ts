import { describe, expect, it, vi, type Mock } from 'vitest';

const putMock: Mock<(pathname: string, body: string) => Promise<{ url: string }>> = vi.fn(
  (pathname) => Promise.resolve({ url: `https://blob.test/${pathname}` }),
);
vi.mock('@vercel/blob', () => ({ put: putMock }));

const { POST: handler } = await import('./screenshots.js');

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/screenshots', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  projectId: 'modern-museum',
  panoramaId: '5-06',
  media: {
    url: 'https://blob.test/screenshots/media/a.png',
    pathname: 'screenshots/media/a.png',
    contentType: 'image/png',
  },
  width: 2400,
  height: 1600,
  template: null,
};

describe('POST /api/screenshots', () => {
  it('persists a valid screenshot record with a null userId', async () => {
    putMock.mockClear();
    const res = await handler(jsonRequest(validBody));
    const json = (await res.json()) as { ok: boolean; id: string };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0]?.[0]).toBe(`screenshots/records/${json.id}.json`);
    const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as { userId: unknown };
    expect(stored.userId).toBeNull();
  });

  it('rejects a missing project or panorama id', async () => {
    const res = await handler(jsonRequest({ ...validBody, projectId: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects a malformed media reference', async () => {
    const res = await handler(jsonRequest({ ...validBody, media: { url: 'not-https' } }));
    expect(res.status).toBe(400);
  });

  it('rejects missing dimensions', async () => {
    const res = await handler(jsonRequest({ ...validBody, width: undefined }));
    expect(res.status).toBe(400);
  });

  it('rejects an absurd out-of-range dimension', async () => {
    const res = await handler(jsonRequest({ ...validBody, width: 999999 }));
    expect(res.status).toBe(400);
  });

  it('accepts a template string when provided', async () => {
    putMock.mockClear();
    const res = await handler(jsonRequest({ ...validBody, template: 'owner-overlay' }));
    expect(res.status).toBe(200);
    const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as { template: unknown };
    expect(stored.template).toBe('owner-overlay');
  });
});
