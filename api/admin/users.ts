import { requireAdmin } from '../_lib/adminAuth.js';
import { getSupabase } from '../_lib/supabase.js';
import type { UserRow } from '../_lib/db.types.js';

/** Real-RBAC read access to the users table for the Admin Panel. */

export async function GET(request: Request): Promise<Response> {
  const auth = await requireAdmin(request);
  if (!auth.ok) {
    return auth.response;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: 'Database is not configured.' }, { status: 500 });
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
    .overrideTypes<UserRow[], { merge: false }>();

  if (error) {
    console.error('GET /api/admin/users: query failed', error);
    return Response.json({ error: 'Could not list users right now.' }, { status: 500 });
  }

  return Response.json({ users: data, count: data.length });
}
