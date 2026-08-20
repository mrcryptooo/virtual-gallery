import { list } from '@vercel/blob';
import { getSessionUser } from '../_lib/_session.js';
import type { ScreenshotRecord } from '../../apps/portfolio/src/lib/community/types.js';

const PREFIX = 'screenshots/records/';

/**
 * GET /api/me/screenshots -- the signed-in user's own museum screenshot
 * gallery (Phase 6: "user's museum screenshot gallery"). Ownership check
 * happens server-side against the session's real user id; there is no
 * client-suppliable filter that could return someone else's captures.
 */
export async function GET(request: Request): Promise<Response> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
    const records = await Promise.all(
      blobs.map((blob) => fetch(blob.url).then((r) => r.json() as Promise<ScreenshotRecord>)),
    );
    const mine = records
      .filter((r) => r.userId === sessionUser.user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return Response.json({ screenshots: mine, count: mine.length });
  } catch (error) {
    console.error('GET /api/me/screenshots: list failed', error);
    return Response.json({ error: 'Could not load your gallery right now.' }, { status: 500 });
  }
}
