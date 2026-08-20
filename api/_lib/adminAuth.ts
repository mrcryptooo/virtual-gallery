import { getSessionUser, type SessionUser } from './session.js';

/**
 * Real admin RBAC: session → user → role, deny-by-default. Replaces the
 * earlier static-bearer-token gate (ADMIN_API_TOKEN) now that a real
 * database/session layer exists. Every admin route calls this first and
 * either gets a verified admin SessionUser or a ready-to-return Response
 * -- 401 with no session at all, 403 with a valid session that isn't an
 * admin. There is no client-side-only check anywhere: a hidden UI button
 * is not authorization, this function is.
 */
export type AdminAuthResult = { ok: true; user: SessionUser } | { ok: false; response: Response };

export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return { ok: false, response: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (sessionUser.user.role !== 'admin') {
    return { ok: false, response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, user: sessionUser };
}
