import { put } from '@vercel/blob';
import { notifyAdmin } from './_lib/telegram.js';
import type {
  ScreenshotRecord,
  SubmissionMedia,
} from '../apps/portfolio/src/lib/community/types.js';

/**
 * Stores museum screenshot metadata (small JSON only -- the PNG already
 * lives in Blob storage by the time this runs, see screenshot-upload.ts)
 * as its own record under screenshots/records/<id>.json. Same "Blob as
 * the whole persistence layer" pattern as submissions.ts, for the same
 * reason: `list({ prefix: 'screenshots/' })` is enough for a future admin
 * dashboard / profile gallery to enumerate every capture without a
 * database.
 *
 * `userId` is always null right now -- there is no authentication system
 * in this project yet (see docs note on ScreenshotRecord). This endpoint
 * accepts an already-null userId and does not invent one; wiring a real
 * user into this record is exactly the kind of change that becomes
 * possible without a migration once real auth exists.
 */

const MAX_DIMENSION = 8000; // sanity bound, not a real camera-sensor size

interface ScreenshotInput {
  projectId?: unknown;
  panoramaId?: unknown;
  media?: unknown;
  width?: unknown;
  height?: unknown;
  template?: unknown;
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
    typeof media['contentType'] === 'string'
  );
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

  const record: ScreenshotRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userId: null,
    projectId,
    panoramaId,
    media: input.media,
    width: input.width,
    height: input.height,
    template: typeof input.template === 'string' ? str(input.template, 100) : null,
  };

  await put(`screenshots/records/${record.id}.json`, JSON.stringify(record, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });

  notifyAdmin({ type: 'new-screenshot', projectId, panoramaId, id: record.id });

  return Response.json({ ok: true, id: record.id });
}
