/**
 * Telegram admin-notification foundation. Server-side only (this file is
 * never imported by anything under apps/portfolio/src, only by other
 * api/* routes) -- the bot token never reaches the browser, matching the
 * project's existing pattern for secrets (BLOB_READ_WRITE_TOKEN,
 * ADMIN_API_TOKEN both work the same way: read from process.env inside a
 * serverless function, never shipped to the client bundle).
 *
 * Deliberately a narrow, typed event catalogue rather than a generic
 * "send any string" function -- the spec asks for a *meaningful*
 * notification layer, not a firehose of every browser event. Add a new
 * case to AdminEvent + formatMessage() when a genuinely new class of
 * event needs to notify, not per call site.
 *
 * Real-time events implemented here: new submission, new screenshot.
 * NOT implemented in this milestone (see the Phase 2 report): the daily
 * summary digest (unique visitors/sessions/registered users/most-visited
 * panoramas) -- that needs either a Vercel Cron job or an external
 * scheduler hitting a new endpoint, plus a way to count "visitors" that
 * doesn't exist yet (no analytics/session tracking in this project). This
 * module's shape does not block adding that later.
 */

export type AdminEvent =
  | { type: 'new-submission'; artistName: string; artworkTitle: string; id: string }
  | { type: 'new-screenshot'; projectId: string; panoramaId: string; id: string }
  | { type: 'system-error'; context: string; message: string };

function formatMessage(event: AdminEvent): string {
  switch (event.type) {
    case 'new-submission':
      return (
        `🎨 New Submit Your Art entry\n` +
        `Artist: ${event.artistName}\n` +
        `Title: ${event.artworkTitle}\n` +
        `id: ${event.id}`
      );
    case 'new-screenshot':
      return (
        `📸 New museum screenshot\n` +
        `Project: ${event.projectId}\n` +
        `Scene: ${event.panoramaId}\n` +
        `id: ${event.id}`
      );
    case 'system-error':
      return `⚠️ System error (${event.context})\n${event.message}`;
  }
}

/**
 * Fire-and-forget: never throws, never blocks the caller. If
 * TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID isn't set (the default --
 * the owner provides these separately, per the milestone spec), this is a
 * silent no-op rather than a broken feature or an exposed error.
 */
export function notifyAdmin(event: AdminEvent): void {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_ADMIN_CHAT_ID'];
  if (!token || !chatId) {
    return;
  }

  const text = formatMessage(event);
  fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  }).catch((error: unknown) => {
    // Never let a notification failure affect the actual request this was
    // triggered from -- log server-side only.
    console.error('notifyAdmin: Telegram send failed', error);
  });
}
