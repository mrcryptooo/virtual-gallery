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
const REQUIRED_PREFIX = 'submissions/media/';

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      // The SDK's onBeforeGenerateToken return type has no `pathname`
      // field -- an earlier version of this route returned one hoping to
      // rewrite the path server-side, which the SDK silently ignored, so
      // every submission was actually written to whatever bare filename
      // the client requested, never under this prefix. api/submissions.ts
      // requires the stored pathname to start with submissions/media/, so
      // every submission with an uploaded file was rejected (same bug as
      // api/screenshot-upload.ts). The client now requests the
      // fully-prefixed path itself (see SubmitArtPage.tsx); this only
      // verifies that request, rejecting a token for anything outside the
      // prefix this route is allowed to grant.
      // eslint-disable-next-line @typescript-eslint/require-await
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(REQUIRED_PREFIX)) {
          throw new Error(`Art submission uploads must be written under ${REQUIRED_PREFIX}`);
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: 'art-submission' }),
        };
      },
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
