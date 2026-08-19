import { head, list } from '@vercel/blob';
import type { SubmissionRecord } from '../../apps/portfolio/src/lib/community/types.js';

/**
 * Internal, authenticated read access to Submit Your Art records for the
 * future /admin dashboard (not built this phase). Deliberately GET-only:
 * status changes and notes are a later phase per the owner's spec, this
 * route only needs to prove list/get/media-preview access can be secured
 * without a database migration.
 *
 * Auth: a single shared secret (`ADMIN_API_TOKEN`, set in the Vercel
 * project's environment variables, never committed) checked as a Bearer
 * token. This is intentionally the smallest workable gate -- swap it for
 * real session-based admin auth when the /admin UI is actually built.
 *
 * Never exposes this list publicly: with no token configured the route
 * refuses every request (fails closed), and it is never linked from any
 * public page.
 */

const PREFIX = 'submissions/records/';

function isAuthorized(request: Request): boolean {
  const expected = process.env['ADMIN_API_TOKEN'];
  if (!expected) {
    return false;
  }
  const auth = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(auth);
  return match !== null && match[1] === expected;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!isAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

  const { blobs } = await list({ prefix: PREFIX, limit: 200 });
  const records = await Promise.all(
    blobs.map((blob) => fetch(blob.url).then((r) => r.json() as Promise<SubmissionRecord>)),
  );
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return Response.json({ records, count: records.length });
}
