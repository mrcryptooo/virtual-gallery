import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { getSupabase } from './_supabase.js';
import type { SessionRow, UserRow } from './_db.types.js';

/**
 * Real, revocable server-side sessions -- not a stateless JWT. The cookie
 * only ever carries an opaque session id (HMAC-signed so a corrupted or
 * guessed value is rejected before it ever reaches the database); role
 * and profile data are always re-read from Postgres on each request, so
 * a role change or logout takes effect immediately rather than waiting
 * out a token's expiry.
 */

export const SESSION_COOKIE = 'seismic_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

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

export function encodeSessionCookieValue(sessionId: string): string {
  return `${sessionId}.${sign(sessionId)}`;
}

export function decodeSessionCookieValue(raw: string): string | null {
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const id = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (!id || !mac) return null;
  let expected: string;
  try {
    expected = sign(id);
  } catch {
    return null;
  }
  return safeEqual(mac, expected) ? id : null;
}

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

export function sessionCookieHeader(value: string, maxAgeSeconds: number): string {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${String(maxAgeSeconds)}`,
  ];
  return attrs.join('; ');
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export interface SessionUser {
  session: SessionRow;
  user: UserRow;
}

/**
 * Creates a real row in `sessions`, returns the signed cookie value to
 * hand back to the browser. Never trusts a client-supplied user id --
 * callers pass the user id they just resolved server-side from the OAuth
 * callback.
 */
export async function createSession(userId: string, userAgent: string | null): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error('Supabase is not configured');
  }
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await supabase
    .from('sessions')
    .insert({ id, user_id: userId, expires_at: expiresAt, user_agent: userAgent });
  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }
  return encodeSessionCookieValue(id);
}

export async function revokeSession(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase
    .from('sessions')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', sessionId);
}

/**
 * Resolves the current request's session + user, or null if there isn't
 * a valid, unexpired, unrevoked one. This is the single source of truth
 * every authenticated/admin route should call -- never trust any
 * client-supplied identity field.
 */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const raw = readCookie(request, SESSION_COOKIE);
  if (!raw) return null;
  const sessionId = decodeSessionCookieValue(raw);
  if (!sessionId) return null;

  const supabase = getSupabase();
  if (!supabase) return null;

  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle<SessionRow>();
  if (sessionError || !session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .maybeSingle<UserRow>();
  if (userError || !user) return null;

  return { session, user };
}
