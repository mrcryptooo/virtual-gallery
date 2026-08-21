import { afterEach, describe, expect, it, vi } from 'vitest';

const { handleUploadMock } = vi.hoisted(() => ({ handleUploadMock: vi.fn() }));
vi.mock('@vercel/blob/client', () => ({ handleUpload: handleUploadMock }));

const { POST: handler } = await import('./blob-upload.js');

function tokenRequest(pathname: string): Request {
  return new Request('http://localhost/api/blob-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, callbackUrl: 'http://localhost/api/blob-upload' },
    }),
  });
}

afterEach(() => {
  handleUploadMock.mockReset();
});

describe('POST /api/blob-upload', () => {
  it('grants a token for a pathname under submissions/media/', async () => {
    handleUploadMock.mockImplementation(
      async ({
        body,
        onBeforeGenerateToken,
      }: {
        body: { payload: { pathname: string } };
        onBeforeGenerateToken: (
          pathname: string,
          clientPayload: string | null,
          multipart: boolean,
        ) => Promise<Record<string, unknown>>;
      }) => {
        const result = await onBeforeGenerateToken(body.payload.pathname, null, false);
        return { type: 'blob.generate-client-token', clientToken: 'token', ...result };
      },
    );

    const res = await handler(tokenRequest('submissions/media/artwork.png'));
    expect(res.status).toBe(200);
    expect(handleUploadMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a pathname outside submissions/media/ -- proof the prefix is actually enforced, not silently dropped like the SDK's onBeforeGenerateToken pathname field used to be", async () => {
    handleUploadMock.mockImplementation(
      async ({
        body,
        onBeforeGenerateToken,
      }: {
        body: { payload: { pathname: string } };
        onBeforeGenerateToken: (
          pathname: string,
          clientPayload: string | null,
          multipart: boolean,
        ) => Promise<Record<string, unknown>>;
      }) => {
        const result = await onBeforeGenerateToken(body.payload.pathname, null, false);
        return { type: 'blob.generate-client-token', clientToken: 'token', ...result };
      },
    );

    const res = await handler(tokenRequest('artwork.png'));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('submissions/media/');
  });
});
