import { head, list } from '@vercel/blob';
import { isAdminAuthorized } from '../_lib/adminAuth.js';
import type { ScreenshotRecord } from '../../apps/portfolio/src/lib/community/types.js';

/**
 * Internal, authenticated read access to museum screenshot records --
 * mirrors api/admin/submissions.ts exactly (same auth gate, same
 * list/get-by-id shape). See ScreenshotRecord: userId is always null
 * right now (no authentication system exists yet), so this cannot yet
 * answer "which user captured this" -- only "what/where/when".
 */

const PREFIX = 'screenshots/records/';

export async function GET(request: Request): Promise<Response> {
  if (!isAdminAuthorized(request)) {
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
