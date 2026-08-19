import { describe, expect, it, vi, type Mock } from 'vitest';

const putMock: Mock<(pathname: string, body: string) => Promise<{ url: string }>> = vi.fn(
  (pathname) => Promise.resolve({ url: `https://blob.test/${pathname}` }),
);
vi.mock('@vercel/blob', () => ({ put: putMock }));

const { default: handler } = await import('./submissions');

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/submissions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validMedia = [
  {
    url: 'https://blob.test/submissions/media/a.png',
    pathname: 'submissions/media/a.png',
    contentType: 'image/png',
  },
];

const validBody = {
  artistName: 'Ada Test',
  email: 'ada@example.com',
  socialLinks: '',
  artworkTitle: 'Fault Line',
  description: 'A study in tension.',
  medium: 'photography',
  portfolioUrl: '',
  media: validMedia,
  consent: true,
};

describe('POST /api/submissions', () => {
  it('rejects non-POST methods', async () => {
    const res = await handler(new Request('http://localhost/api/submissions'));
    expect(res.status).toBe(405);
  });

  it('persists a valid submission and returns its id', async () => {
    putMock.mockClear();
    const res = await handler(jsonRequest(validBody));
    const json = (await res.json()) as { ok: boolean; id: string };
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(typeof json.id).toBe('string');
    expect(putMock).toHaveBeenCalledTimes(1);
    expect(putMock.mock.calls[0]?.[0]).toBe(`submissions/records/${json.id}.json`);
  });

  it('defaults new records to pending status', async () => {
    putMock.mockClear();
    await handler(jsonRequest(validBody));
    const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as { status: string };
    expect(stored.status).toBe('pending');
  });

  it('rejects a missing required field', async () => {
    const res = await handler(jsonRequest({ ...validBody, artistName: '' }));
    expect(res.status).toBe(400);
  });

  it('rejects an invalid email address', async () => {
    const res = await handler(jsonRequest({ ...validBody, email: 'not-an-email' }));
    expect(res.status).toBe(400);
  });

  it('rejects zero media files', async () => {
    const res = await handler(jsonRequest({ ...validBody, media: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects more than three media files', async () => {
    const media = [validMedia[0], validMedia[0], validMedia[0], validMedia[0]];
    const res = await handler(jsonRequest({ ...validBody, media }));
    expect(res.status).toBe(400);
  });

  it('rejects submission without consent', async () => {
    const res = await handler(jsonRequest({ ...validBody, consent: false }));
    expect(res.status).toBe(400);
  });

  it('drops media entries that are not well-formed', async () => {
    putMock.mockClear();
    const res = await handler(
      jsonRequest({ ...validBody, media: [validMedia[0], { url: 'not-https' }] }),
    );
    expect(res.status).toBe(200);
    const stored = JSON.parse(putMock.mock.calls[0]?.[1] as string) as { media: unknown[] };
    expect(stored.media).toHaveLength(1);
  });
});
