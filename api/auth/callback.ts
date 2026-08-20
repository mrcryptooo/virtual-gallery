import {
  callbackUrlFor,
  clearOAuthCookieHeader,
  decodeOAuthCookie,
  exchangeCodeForXProfile,
  readOAuthCookie,
} from '../_lib/oauth.js';
import { getSupabase } from '../_lib/supabase.js';
import { createSession, sessionCookieHeader } from '../_lib/session.js';
import type { UserRow } from '../_lib/db.types.js';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function redirectWithClearedOAuthCookie(
  location: string,
  extraHeaders: HeadersInit = {},
): Response {
  const headers = new Headers(extraHeaders);
  headers.append('Set-Cookie', clearOAuthCookieHeader());
  headers.set('Location', location);
  return new Response(null, { status: 302, headers });
}

/**
 * GET /api/auth/callback -- X redirects here after the visitor approves
 * (or denies) the app. Validates `state` against the value this app
 * itself set in login.ts (CSRF protection), exchanges the code (+PKCE
 * verifier) for a one-time access token, reads the visitor's X profile
 * exactly once, upserts `users`, creates a real server-side session, and
 * redirects back into the app. The X access token itself is never
 * stored -- see oauth.ts's header comment for why.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const oauthCookie = decodeOAuthCookie(readOAuthCookie(request));

  if (error) {
    // The visitor denied the app, or X reported some other error --
    // not a bug, send them back cleanly rather than showing a stack
    // trace.
    return redirectWithClearedOAuthCookie(`/?auth_error=denied`);
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!oauthCookie || !code || !state || state !== oauthCookie.state) {
    // Missing/expired cookie, or a state mismatch -- exactly the CSRF
    // case this flow exists to catch. Do not proceed.
    return redirectWithClearedOAuthCookie(`/?auth_error=invalid_state`);
  }

  const supabase = getSupabase();
  if (!supabase) {
    return redirectWithClearedOAuthCookie(`/?auth_error=not_configured`);
  }

  let profile;
  try {
    profile = await exchangeCodeForXProfile(code, oauthCookie.verifier, callbackUrlFor(request));
  } catch (err) {
    console.error('GET /api/auth/callback: X token exchange failed', err);
    return redirectWithClearedOAuthCookie(`/?auth_error=exchange_failed`);
  }

  const initialAdminXUserId = process.env['INITIAL_ADMIN_X_USER_ID'];

  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('*')
    .eq('x_user_id', profile.id)
    .maybeSingle<UserRow>();
  if (lookupError) {
    console.error('GET /api/auth/callback: user lookup failed', lookupError);
    return redirectWithClearedOAuthCookie(`/?auth_error=server_error`);
  }

  let userId: string;
  if (existing) {
    userId = existing.id;
    const shouldPromote =
      !!initialAdminXUserId && profile.id === initialAdminXUserId && existing.role !== 'admin';
    const { error: updateError } = await supabase
      .from('users')
      .update({
        x_username: profile.username,
        display_name: existing.display_name, // never overwrite an edited display name with X's
        avatar_url: existing.avatar_url ?? profile.profileImageUrl,
        ...(shouldPromote ? { role: 'admin' } : {}),
      })
      .eq('id', existing.id);
    if (updateError) {
      console.error('GET /api/auth/callback: user update failed', updateError);
      return redirectWithClearedOAuthCookie(`/?auth_error=server_error`);
    }
  } else {
    const role = initialAdminXUserId && profile.id === initialAdminXUserId ? 'admin' : 'user';
    const { data: created, error: insertError } = await supabase
      .from('users')
      .insert({
        x_user_id: profile.id,
        x_username: profile.username,
        display_name: profile.name,
        avatar_url: profile.profileImageUrl,
        role,
      })
      .select('id')
      .single()
      .overrideTypes<{ id: string }, { merge: false }>();
    // overrideTypes asserts `created` is always defined, but that's a
    // compile-time-only guarantee -- Supabase can still genuinely return
    // { data: null, error: null } (e.g. an RLS policy silently filtering
    // the row back out). Keep the runtime check.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (insertError || !created) {
      console.error('GET /api/auth/callback: user create failed', insertError);
      return redirectWithClearedOAuthCookie(`/?auth_error=server_error`);
    }
    userId = created.id;
  }

  let cookieValue: string;
  try {
    cookieValue = await createSession(userId, request.headers.get('user-agent'));
  } catch (err) {
    console.error('GET /api/auth/callback: session creation failed', err);
    return redirectWithClearedOAuthCookie(`/?auth_error=server_error`);
  }

  const headers = new Headers();
  headers.append('Set-Cookie', clearOAuthCookieHeader());
  headers.append('Set-Cookie', sessionCookieHeader(cookieValue, SESSION_MAX_AGE_SECONDS));
  headers.set('Location', oauthCookie.redirectTo);
  return new Response(null, { status: 302, headers });
}
