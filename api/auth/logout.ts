import {
  clearSessionCookieHeader,
  decodeSessionCookieValue,
  readCookie,
  revokeSession,
  SESSION_COOKIE,
} from '../_lib/session.js';

/**
 * GET /api/auth/logout -- a real server-side session revocation (marks
 * the row in `sessions` as revoked), not just clearing a client-side
 * flag. A plain link works; no JS required.
 */
export async function GET(request: Request): Promise<Response> {
  const raw = readCookie(request, SESSION_COOKIE);
  // Only ever revoke a session whose signature this server actually
  // produced -- never trust an unsigned/tampered id extracted by naive
  // string-splitting, which would let anyone revoke an arbitrary
  // session id.
  const sessionId = raw ? decodeSessionCookieValue(raw) : null;
  if (sessionId) {
    await revokeSession(sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      'Set-Cookie': clearSessionCookieHeader(),
    },
  });
}
