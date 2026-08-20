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
 * Real-time events: new submission, new screenshot. Daily digest: see
 * api/cron/daily-summary.ts, which calls sendTelegramMessage directly
 * (it needs to know success/failure to log and to decide whether to
 * write its dedupe marker) rather than the fire-and-forget notifyAdmin.
 * The digest deliberately only reports submissions/screenshots -- real,
 * already-persisted activity -- not "unique visitors" or "sessions",
 * which would need a visitor-analytics service this project does not
 * have (see docs/reports/premium-experience-infrastructure-boundary.md).
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
 * Low-level send. Throws on failure (network error or a non-2xx from
 * Telegram) so callers that need to know the outcome (the cron digest)
 * can catch it; notifyAdmin below wraps this for its own fire-and-forget
 * callers instead. Returns false without throwing if the two required
 * env vars aren't configured -- "not configured" is not a failure to log
 * as one.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_ADMIN_CHAT_ID'];
  if (!token || !chatId) {
    return false;
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!response.ok) {
    throw new Error(`Telegram API responded ${String(response.status)}`);
  }
  return true;
}

/**
 * Fire-and-forget: never throws, never blocks the caller. Silent no-op
 * (not an error) if Telegram isn't configured -- the app never breaks or
 * exposes an error just because these aren't set up yet.
 */
export function notifyAdmin(event: AdminEvent): void {
  sendTelegramMessage(formatMessage(event)).catch((error: unknown) => {
    // Never let a notification failure affect the actual request this was
    // triggered from -- log server-side only.
    console.error('notifyAdmin: Telegram send failed', error);
  });
}
