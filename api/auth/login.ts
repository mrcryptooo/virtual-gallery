import {
  X_AUTHORIZE_URL,
  X_SCOPES,
  callbackUrlFor,
  encodeOAuthCookie,
  generatePkcePair,
  generateState,
  oauthCookieHeader,
} from '../_lib/oauth.js';

/**
 * GET /api/auth/login -- starts the X OAuth 2.0 + PKCE flow. A plain
 * link (`<a href="/api/auth/login">Sign in with X</a>`) is enough; this
 * needs no JS on the client.
 */
// Vercel's Function type accepts a plain (non-Promise) Response too, but
// every other route here is async; keeping this one's signature
// consistent (and Promise<Response>-typed) is worth a single disable.
// eslint-disable-next-line @typescript-eslint/require-await
export async function GET(request: Request): Promise<Response> {
  if (!process.env['X_CLIENT_ID']) {
    return Response.json({ error: 'X sign-in is not configured yet.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const rawRedirect = url.searchParams.get('redirectTo') ?? '/';
  // Only ever redirect back into this same app -- never follow an
  // absolute/external URL supplied via a query param (open-redirect
  // guard).
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/';

  const { verifier, challenge } = generatePkcePair();
  const state = generateState();
  const cookieValue = encodeOAuthCookie({ state, verifier, redirectTo });

  const authorizeUrl = new URL(X_AUTHORIZE_URL);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', process.env['X_CLIENT_ID'] ?? '');
  authorizeUrl.searchParams.set('redirect_uri', callbackUrlFor(request));
  authorizeUrl.searchParams.set('scope', X_SCOPES);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorizeUrl.toString(),
      'Set-Cookie': oauthCookieHeader(cookieValue),
    },
  });
}
