import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';

/**
 * Issues short-lived, scoped tokens for client-side direct-to-Blob uploads
 * (Submit Your Art, apps/portfolio/src/app/SubmitArtPage.tsx). The media
 * bytes never pass through this function or any serverless body-size limit
 * -- the browser uploads straight to Vercel Blob using the token this
 * returns, which is the documented pattern for user-uploaded files on
 * Vercel. This route only ever hands out permission to write one file to
 * a fixed prefix with a fixed allow-list; it never receives file content.
 */

const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const MAX_UPLOAD_BYTES = 80 * 1024 * 1024;

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // The SDK's type requires this to return a Promise even though no
      // actual async work is needed here (no auth/DB lookup for this route).
      // eslint-disable-next-line @typescript-eslint/require-await
      onBeforeGenerateToken: async (pathname) => ({
        pathname: `submissions/media/${pathname}`,
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ purpose: 'art-submission' }),
      }),
      onUploadCompleted: async () => {
        // No follow-up needed here -- the client posts the resulting URL to
        // /api/submissions once all files finish, which is what actually
        // creates the submission record.
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
