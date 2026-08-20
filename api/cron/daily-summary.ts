import { list, put } from '@vercel/blob';
import { sendTelegramMessage } from '../_lib/telegram.js';
import type {
  ScreenshotRecord,
  SubmissionRecord,
} from '../../apps/portfolio/src/lib/community/types.js';

/**
 * Daily activity digest, triggered by Vercel Cron (see the `crons` entry
 * in vercel.json, 09:00 UTC). Reports real, already-persisted activity --
 * submissions and screenshots -- not "unique visitors" or "sessions",
 * which would need a visitor-analytics service this project does not
 * have. See docs/reports/premium-experience-infrastructure-boundary.md
 * for why that's out of scope here rather than faked.
 *
 * Auth: Vercel automatically sends `Authorization: Bearer $CRON_SECRET`
 * on cron-triggered requests once a `CRON_SECRET` env var is set on the
 * project (https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs)
 * -- this is the documented, zero-extra-infrastructure way to stop the
 * endpoint being triggered by anyone who finds the URL. Owner-generated,
 * not a third-party credential (any random string works).
 *
 * Dedupe: writes a marker blob under `cron/daily-summary/<date>.json`
 * after a successful send; a second trigger for the same UTC date (manual
 * or a duplicate cron invocation) finds the marker and skips instead of
 * sending twice.
 */

function isAuthorizedCron(request: Request): boolean {
  const secret = process.env['CRON_SECRET'];
  if (!secret) {
    return false;
  }
  const auth = request.headers.get('authorization') ?? '';
  return auth === `Bearer ${secret}`;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function isFromToday(createdAt: string, date: string): boolean {
  return createdAt.startsWith(date);
}

async function listRecords<T>(prefix: string): Promise<T[]> {
  const { blobs } = await list({ prefix, limit: 1000 });
  return Promise.all(blobs.map((blob) => fetch(blob.url).then((r) => r.json() as Promise<T>)));
}

function mostCaptured(screenshots: ScreenshotRecord[]): string | null {
  const counts = new Map<string, number>();
  for (const s of screenshots) {
    counts.set(s.panoramaId, (counts.get(s.panoramaId) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [panoramaId, count] of counts) {
    if (count > bestCount) {
      best = panoramaId;
      bestCount = count;
    }
  }
  return best;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorizedCron(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const date = todayUTC();
  const markerPath = `cron/daily-summary/${date}.json`;

  const existing = await list({ prefix: markerPath, limit: 1 });
  if (existing.blobs.length > 0) {
    return Response.json({ ok: true, skipped: true, reason: 'already sent for this date', date });
  }

  let submissions: SubmissionRecord[];
  let screenshots: ScreenshotRecord[];
  try {
    [submissions, screenshots] = await Promise.all([
      listRecords<SubmissionRecord>('submissions/records/'),
      listRecords<ScreenshotRecord>('screenshots/records/'),
    ]);
  } catch (error) {
    console.error('GET /api/cron/daily-summary: failed to list records', error);
    return Response.json({ error: 'Could not read activity records.' }, { status: 500 });
  }

  const todaySubmissions = submissions.filter((s) => isFromToday(s.createdAt, date));
  const todayScreenshots = screenshots.filter((s) => isFromToday(s.createdAt, date));
  const topPanorama = mostCaptured(todayScreenshots);

  const summary = {
    date,
    submissions: todaySubmissions.length,
    screenshots: todayScreenshots.length,
    topPanorama,
  };

  const text =
    `📊 Seismic Museum -- daily summary (${date})\n` +
    `Submit Your Art entries: ${String(summary.submissions)}\n` +
    `Screenshots captured: ${String(summary.screenshots)}\n` +
    `Most-captured scene: ${topPanorama ?? 'none'}`;

  let sent: boolean;
  try {
    sent = await sendTelegramMessage(text);
  } catch (error) {
    console.error('GET /api/cron/daily-summary: Telegram send failed', error);
    return Response.json(
      { error: 'Digest computed but Telegram send failed.', summary },
      { status: 502 },
    );
  }

  // Only mark the day as "done" once we know either the message really
  // went out, or Telegram genuinely isn't configured (in which case there
  // is nothing to retry -- logging the computed summary is the fallback).
  try {
    await put(markerPath, JSON.stringify({ ...summary, sent }, null, 2), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
  } catch (error) {
    // The digest itself succeeded (or was correctly skipped); a failed
    // marker write only risks a duplicate send tomorrow's run would catch
    // via the same date check, not a broken digest -- log, don't fail.
    console.error('GET /api/cron/daily-summary: failed to write dedupe marker', error);
  }

  if (!sent) {
    console.log('daily-summary: Telegram not configured, computed summary only', summary);
  }

  return Response.json({ ok: true, sent, summary });
}
