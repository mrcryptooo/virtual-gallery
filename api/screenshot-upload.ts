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

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // eslint-disable-next-line @typescript-eslint/require-await
      onBeforeGenerateToken: async (pathname) => ({
        pathname: `screenshots/media/${pathname}`,
        allowedContentTypes: ['image/png'],
        maximumSizeInBytes: MAX_SCREENSHOT_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ purpose: 'museum-screenshot' }),
      }),
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
