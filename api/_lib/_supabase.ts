import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side-only Supabase client, using the service role key. This
 * module is imported exclusively by other api/* routes -- never by
 * anything under apps/portfolio/src -- so the service role key never
 * reaches the browser (same pattern as every other secret in this
 * project: read from process.env inside a serverless function, nothing
 * else). The browser never talks to Supabase directly; every read/write
 * goes through this project's own API routes, which is also why Row
 * Level Security on the underlying tables (see supabase/migrations) is
 * defense-in-depth rather than the primary access control.
 *
 * Returns null (not a throw) when the two required env vars aren't
 * configured, so routes that depend on this can degrade to "auth not
 * configured yet" instead of crashing the whole function.
 */

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) {
    return cached;
  }
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key) {
    cached = null;
    return cached;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
