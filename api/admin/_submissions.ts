import { head, list } from '@vercel/blob';
import { requireAdmin } from '../_lib/_adminAuth.js';
import type { SubmissionRecord } from '../../apps/portfolio/src/lib/community/types.js';

/**
 * Real-RBAC read access to Submit Your Art records for the Admin Panel.
 * Deliberately GET-only: status changes and notes are a later phase,
 * this route only needs to prove list/get/media-preview access is
 * properly secured. Auth is requireAdmin() -- a real session resolved to
 * an admin-role user in Postgres, not a shared bearer token.
 *
 * Dispatched from api/admin/[resource].ts, not exported as GET directly
 * -- see that file's header comment (Vercel's Hobby-plan Function limit).
 */

const PREFIX = 'submissions/records/';

export async function handleSubmissions(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) {
      return Response.json({ error: 'Invalid id' }, { status: 400 });
    }
    try {
      const blob = await head(`${PREFIX}${id}.json`);
      const record = (await fetch(blob.url).then((r) => r.json())) as SubmissionRecord;
      return Response.json({ record });
    } catch {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
  }

  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 200 });
    const records = await Promise.all(
      blobs.map((blob) => fetch(blob.url).then((r) => r.json() as Promise<SubmissionRecord>)),
    );
    records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ records, count: records.length });
  } catch (error) {
    console.error('GET /api/admin/submissions: list failed', error);
    return Response.json({ error: 'Could not list submissions right now.' }, { status: 500 });
  }
}
