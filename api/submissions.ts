import { put } from '@vercel/blob';
import { notifyAdmin } from './_lib/telegram.js';
import { getSessionUser } from './_lib/session.js';
import type {
  SubmissionMedia,
  SubmissionRecord,
} from '../apps/portfolio/src/lib/community/types.js';

/**
 * Stores Submit Your Art metadata (small JSON only -- media bytes already
 * live in Blob storage by the time this runs, see blob-upload.ts) as its
 * own record under submissions/<id>.json. Deliberately not a database:
 * Vercel Blob's `list({ prefix: 'submissions/' })` is enough for the
 * Phase 2 admin dashboard to enumerate and read every record, which is
 * the smallest persistent solution that doesn't need a schema migration
 * to support that later -- see SubmissionRecord for the exact shape an
 * admin UI would read.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MEDIA = 3;

interface SubmissionInput {
  artistName?: unknown;
  email?: unknown;
  socialLinks?: unknown;
  artworkTitle?: unknown;
  description?: unknown;
  medium?: unknown;
  portfolioUrl?: unknown;
  media?: unknown;
  consent?: unknown;
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function isSubmissionMedia(value: unknown): value is SubmissionMedia {
  if (typeof value !== 'object' || value === null) return false;
  const media = value as Record<string, unknown>;
  return (
    typeof media['url'] === 'string' &&
    media['url'].startsWith('https://') &&
    typeof media['pathname'] === 'string' &&
    // Ties the record to a file that actually went through
    // blob-upload.ts's token (which only ever writes under this prefix),
    // not an arbitrary attacker-supplied HTTPS URL -- otherwise a client
    // could create a "submission" pointing at any external image without
    // ever uploading anything through this app.
    media['pathname'].startsWith('submissions/media/') &&
    typeof media['contentType'] === 'string'
  );
}

export async function POST(request: Request): Promise<Response> {
  let input: SubmissionInput;
  try {
    input = (await request.json()) as SubmissionInput;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const artistName = str(input.artistName, 200);
  const email = str(input.email, 320);
  const artworkTitle = str(input.artworkTitle, 200);
  const description = str(input.description, 4000);
  const media = Array.isArray(input.media) ? input.media.filter(isSubmissionMedia) : [];

  if (!artistName || !email || !artworkTitle || !description) {
    return Response.json({ error: 'Missing required fields.' }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) {
    return Response.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (media.length === 0 || media.length > MAX_MEDIA) {
    return Response.json({ error: 'Attach between 1 and 3 files.' }, { status: 400 });
  }
  if (input.consent !== true) {
    return Response.json({ error: 'Consent is required to submit.' }, { status: 400 });
  }

  const sessionUser = await getSessionUser(request);

  const record: SubmissionRecord = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    userId: sessionUser?.user.id ?? null,
    artistName,
    email,
    socialLinks: str(input.socialLinks, 500),
    artworkTitle,
    description,
    medium: str(input.medium, 100),
    portfolioUrl: str(input.portfolioUrl, 500),
    media,
    status: 'pending',
  };

  try {
    await put(`submissions/records/${record.id}.json`, JSON.stringify(record, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (error) {
    console.error('POST /api/submissions: Blob write failed', error);
    return Response.json(
      { error: 'Could not save your submission right now. Please try again.' },
      { status: 500 },
    );
  }

  notifyAdmin({ type: 'new-submission', artistName, artworkTitle, id: record.id });

  return Response.json({ ok: true, id: record.id });
}
