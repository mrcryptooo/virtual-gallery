import { head, list } from '@vercel/blob';
import { requireAdmin } from '../_lib/_adminAuth.js';
import type { ScreenshotRecord } from '../../apps/portfolio/src/lib/community/types.js';

/**
 * Real-RBAC read access to museum screenshot records -- mirrors
 * api/admin/submissions.ts exactly (same auth gate, same list/get-by-id
 * shape). ScreenshotRecord.userId is now a real users.id when captured
 * by a signed-in visitor, null for anonymous captures.
 *
 * Dispatched from api/admin/[resource].ts, not exported as GET directly
 * -- see that file's header comment (Vercel's Hobby-plan Function limit).
 */

const PREFIX = 'screenshots/records/';

export async function handleScreenshots(request: Request): Promise<Response> {
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
      const record = (await fetch(blob.url).then((r) => r.json())) as ScreenshotRecord;
      return Response.json({ record });
    } catch {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
  }

  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 200 });
    const records = await Promise.all(
      blobs.map((blob) => fetch(blob.url).then((r) => r.json() as Promise<ScreenshotRecord>)),
    );
    records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ records, count: records.length });
  } catch (error) {
    console.error('GET /api/admin/screenshots: list failed', error);
    return Response.json({ error: 'Could not list screenshots right now.' }, { status: 500 });
  }
}
