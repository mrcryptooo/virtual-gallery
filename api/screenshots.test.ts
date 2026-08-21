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
  panoramaTitle: '5.06',
  media: {
    url: 'https://blob.test/screenshots/media/a.png',
    pathname: 'screenshots/media/a.png',
    contentType: 'image/png',
  },
  width: 1920,
  height: 1080,
  template: 'template-2',
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
    const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as {
      userId: unknown;
      panoramaTitle: unknown;
      width: unknown;
      height: unknown;
    };
    expect(stored.userId).toBeNull();
    expect(stored.panoramaTitle).toBe('5.06');
    expect(stored.width).toBe(1920);
    expect(stored.height).toBe(1080);
  });

  it('rejects a missing project or panorama id', async () => {
    const res = await handler(jsonRequest({ ...validBody, projectId: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects a missing panorama title', async () => {
    const res = await handler(jsonRequest({ ...validBody, panoramaTitle: '' }));
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

  it('rejects any dimension other than exactly 1920x1080', async () => {
    const tooLarge = await handler(jsonRequest({ ...validBody, width: 999999 }));
    expect(tooLarge.status).toBe(400);
    const viewportSized = await handler(jsonRequest({ ...validBody, width: 2400, height: 1600 }));
    expect(viewportSized.status).toBe(400);
    const wrongHeight = await handler(jsonRequest({ ...validBody, height: 1081 }));
    expect(wrongHeight.status).toBe(400);
  });

  it('accepts any of the five valid template ids', async () => {
    for (const template of ['template-1', 'template-2', 'template-3', 'template-4', 'template-5']) {
      putMock.mockClear();
      const res = await handler(jsonRequest({ ...validBody, template }));
      expect(res.status).toBe(200);
      const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as { template: unknown };
      expect(stored.template).toBe(template);
    }
  });

  it('accepts a null template', async () => {
    putMock.mockClear();
    const res = await handler(jsonRequest({ ...validBody, template: null }));
    expect(res.status).toBe(200);
    const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as { template: unknown };
    expect(stored.template).toBeNull();
  });

  it('rejects a template id outside the five valid ones', async () => {
    const res = await handler(jsonRequest({ ...validBody, template: 'owner-overlay' }));
    expect(res.status).toBe(400);
  });
});
