import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

/**
 * Issues short-lived, scoped tokens for client-direct-to-Blob uploads of
 * museum screenshots (see the camera control in
 * apps/portfolio/public/tour/modern-museum/index.js). Same pattern as
 * blob-upload.ts (Submit Your Art) but kept as its own endpoint rather than
 * a shared/parameterized one: screenshots and art submissions have
 * different size/type allow-lists and different security boundaries
 * (one is always a same-origin capture, PNG only; the other is arbitrary
 * visitor-supplied media), so narrowing each token route to exactly what
 * it's allowed to do is a smaller blast radius than one generic uploader.
 */

const MAX_SCREENSHOT_BYTES = 15 * 1024 * 1024;
const REQUIRED_PREFIX = 'screenshots/media/';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // The SDK's onBeforeGenerateToken return type has no `pathname`
      // field -- an earlier version of this route returned one hoping to
      // rewrite the path server-side, which the SDK silently ignored, so
      // every screenshot ever saved actually landed at whatever bare
      // filename the client passed (e.g. "museum-screenshot.png"), never
      // under this prefix. api/screenshots.ts requires the stored
      // pathname to start with screenshots/media/, so every save was
      // rejected -- caught via a real end-to-end production capture, not
      // assumed. The client now requests the fully-prefixed path itself
      // (see index.js); this only verifies that request, rejecting a
      // token for anything outside the prefix this route is allowed to
      // grant.
      // eslint-disable-next-line @typescript-eslint/require-await
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(REQUIRED_PREFIX)) {
          throw new Error(`Screenshot uploads must be written under ${REQUIRED_PREFIX}`);
        }
        return {
          allowedContentTypes: ['image/png'],
          maximumSizeInBytes: MAX_SCREENSHOT_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: 'museum-screenshot' }),
        };
      },
      onUploadCompleted: async () => {
        // No follow-up needed -- the client posts the resulting URL to
        // /api/screenshots once the upload finishes, which is what
        // actually creates the screenshot record.
      },
    });
    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Upload token request failed' },
      { status: 400 },
    );
  }
}
