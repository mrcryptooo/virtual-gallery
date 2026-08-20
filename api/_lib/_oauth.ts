import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * X (Twitter) OAuth 2.0 Authorization Code flow with PKCE. This project
 * is a confidential client (has a client secret), so token exchange
 * authenticates with HTTP Basic auth per X's docs, in addition to PKCE.
 * Scopes are the minimum needed to read the signed-in user's own
 * profile once at login time -- no write/DM/offline access is
 * requested, and no X access token is ever stored: it's used once
 * against /2/users/me and discarded, because this app maintains its own
 * session (see session.ts) rather than continuing to act as the user on
 * X's API afterward.
 */

export const X_AUTHORIZE_URL = 'https://x.com/i/oauth2/authorize';
export const X_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
export const X_ME_URL = 'https://api.twitter.com/2/users/me';
export const X_SCOPES = 'users.read tweet.read';

const OAUTH_COOKIE = 'seismic_oauth';
const OAUTH_TTL_SECONDS = 10 * 60; // the whole login round trip should take seconds, not minutes

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function generatePkcePair(): PkcePair {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function generateState(): string {
  return randomBytes(16).toString('base64url');
}

interface OAuthCookiePayload {
  state: string;
  verifier: string;
  redirectTo: string;
}

function sign(value: string): string {
  const secret = process.env['SESSION_SECRET'];
  if (!secret) {
    throw new Error('SESSION_SECRET is not configured');
  }
  return createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function encodeOAuthCookie(payload: OAuthCookiePayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

export function decodeOAuthCookie(raw: string | null): OAuthCookiePayload | null {
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const body = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  if (!safeEqual(mac, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as OAuthCookiePayload;
  } catch {
    return null;
  }
}

export function oauthCookieHeader(value: string): string {
  return [
    `${OAUTH_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/api/auth',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${String(OAUTH_TTL_SECONDS)}`,
  ].join('; ');
}

export function clearOAuthCookieHeader(): string {
  return `${OAUTH_COOKIE}=; Path=/api/auth; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readOAuthCookie(request: Request): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === OAUTH_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/** Canonical production callback -- registered in the X Developer Portal
    app settings by the project owner (a dashboard config, not something
    this codebase can set). Derived from the request's own origin so it
    also works correctly against a Vercel preview deployment during
    testing, as long as that preview URL is *also* registered on X's
    side (X requires an exact allow-listed redirect URI). */
export function callbackUrlFor(request: Request): string {
  return new URL('/api/auth/callback', request.url).toString();
}

export interface XProfile {
  id: string;
  username: string;
  name: string;
  profileImageUrl: string | null;
}

export async function exchangeCodeForXProfile(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<XProfile> {
  const clientId = process.env['X_CLIENT_ID'];
  const clientSecret = process.env['X_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('X OAuth is not configured');
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenRes = await fetch(X_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }).toString(),
  });
  if (!tokenRes.ok) {
    throw new Error(`X token exchange failed: ${String(tokenRes.status)}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch(`${X_ME_URL}?user.fields=profile_image_url,username,name`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!meRes.ok) {
    throw new Error(`X profile fetch failed: ${String(meRes.status)}`);
  }
  const meJson = (await meRes.json()) as {
    data: { id: string; username: string; name: string; profile_image_url?: string };
  };

  return {
    id: meJson.data.id,
    username: meJson.data.username,
    name: meJson.data.name,
    profileImageUrl: meJson.data.profile_image_url ?? null,
  };
}
