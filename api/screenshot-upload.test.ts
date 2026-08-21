import { afterEach, describe, expect, it, vi } from 'vitest';

const { handleUploadMock } = vi.hoisted(() => ({ handleUploadMock: vi.fn() }));
vi.mock('@vercel/blob/client', () => ({ handleUpload: handleUploadMock }));

const { POST: handler } = await import('./screenshot-upload.js');

function tokenRequest(pathname: string): Request {
  return new Request('http://localhost/api/screenshot-upload', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      type: 'blob.generate-client-token',
      payload: { pathname, callbackUrl: 'http://localhost/api/screenshot-upload' },
    }),
  });
}

afterEach(() => {
  handleUploadMock.mockReset();
});

describe('POST /api/screenshot-upload', () => {
  it('grants a token for a pathname under screenshots/media/', async () => {
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

    const res = await handler(tokenRequest('screenshots/media/museum-screenshot.png'));
    expect(res.status).toBe(200);
    expect(handleUploadMock).toHaveBeenCalledTimes(1);
  });

  it("rejects a pathname outside screenshots/media/ -- proof the prefix is actually enforced, not silently dropped like the SDK's onBeforeGenerateToken pathname field used to be", async () => {
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

    const res = await handler(tokenRequest('museum-screenshot.png'));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: string };
    expect(json.error).toContain('screenshots/media/');
  });
});
