import { put } from '@vercel/blob';
import { notifyAdmin } from './_lib/_telegram.js';
import { getSessionUser } from './_lib/_session.js';
import type {
  ScreenshotRecord,
  SubmissionMedia,
} from '../apps/portfolio/src/lib/community/types.js';

/**
 * Stores museum screenshot metadata (small JSON only -- the PNG already
 * lives in Blob storage by the time this runs, see screenshot-upload.ts)
 * as its own record under screenshots/records/<id>.json. Same "Blob as
 * the whole persistence layer" pattern as submissions.ts, for the same
 * reason: `list({ prefix: 'screenshots/' })` is enough for the admin
 * dashboard / profile gallery to enumerate every capture without a
 * separate media database.
 *
 * `userId` is derived from the session -- never trusted from the request
 * body. Anonymous visitors (no session cookie, or an expired/invalid
 * one) get userId: null exactly as before; signed-in visitors get their
 * real users.id.
 */

const MAX_DIMENSION = 8000; // sanity bound, not a real camera-sensor size

interface ScreenshotInput {
  projectId?: unknown;
  panoramaId?: unknown;
  media?: unknown;
  width?: unknown;
  height?: unknown;
  template?: unknown;
  viewport?: unknown;
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isPositiveInt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= MAX_DIMENSION
  );
}

function isScreenshotMedia(value: unknown): value is SubmissionMedia {
  if (typeof value !== 'object' || value === null) return false;
  const media = value as Record<string, unknown>;
  return (
    typeof media['url'] === 'string' &&
    media['url'].startsWith('https://') &&
    typeof media['pathname'] === 'string' &&
    // Ties the record to a file that actually went through
    // screenshot-upload.ts's token (which only ever writes under this
    // prefix), not an arbitrary attacker-supplied HTTPS URL.
    media['pathname'].startsWith('screenshots/media/') &&
    typeof media['contentType'] === 'string'
  );
}

/** Viewport at capture time -- coarse device context for admin review,
    not a fingerprinting signal (no user-agent string, no IP). Optional:
    older/degraded clients may omit it. */
function isViewport(value: unknown): value is { width: number; height: number } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isPositiveInt(v['width']) && isPositiveInt(v['height']);
}

export async function POST(request: Request): Promise<Response> {
  let input: ScreenshotInput;
  try {
    input = (await request.json()) as ScreenshotInput;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const projectId = str(input.projectId, 100);
  const panoramaId = str(input.panoramaId, 100);

  if (!projectId || !panoramaId) {
    return Response.json({ error: 'Missing project or panorama id.' }, { status: 400 });
  }
  if (!isScreenshotMedia(input.media)) {
    return Response.json({ error: 'Missing or malformed media reference.' }, { status: 400 });
  }
  if (!isPositiveInt(input.width) || !isPositiveInt(input.height)) {
    return Response.json({ error: 'Missing or invalid image dimensions.' }, { status: 400 });
  }

  const sessionUser = await getSessionUser(request);

  const record: ScreenshotRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userId: sessionUser?.user.id ?? null,
    projectId,
    panoramaId,
    media: input.media,
    width: input.width,
    height: input.height,
    template: typeof input.template === 'string' ? str(input.template, 100) : null,
    viewport: isViewport(input.viewport) ? input.viewport : null,
  };

  try {
    await put(`screenshots/records/${record.id}.json`, JSON.stringify(record, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error('POST /api/screenshots: Blob write failed', error);
    return Response.json(
      { error: 'Could not save this screenshot right now. Please try again.' },
      { status: 500 },
    );
  }

  notifyAdmin({ type: 'new-screenshot', projectId, panoramaId, id: record.id });

  return Response.json({ ok: true, id: record.id });
}
