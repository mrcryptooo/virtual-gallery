/**
 * Shared bearer-token admin gate for every api/admin/* route. Extracted
 * out of api/admin/submissions.ts (Phase 2) so api/admin/screenshots.ts
 * doesn't duplicate the same check -- one auth boundary, not one per
 * endpoint. Still intentionally the smallest workable gate: a single
 * shared secret (`ADMIN_API_TOKEN`, set server-side in Vercel, never
 * committed), fails closed if unset. Swap for real session-based admin
 * auth when the /admin UI is actually built (see docs on that boundary).
 */
export function isAdminAuthorized(request: Request): boolean {
  const expected = process.env['ADMIN_API_TOKEN'];
  if (!expected) {
    return false;
  }
  const auth = request.headers.get('authorization') ?? '';
  const match = /^Bearer (.+)$/.exec(auth);
  return match !== null && match[1] === expected;
}
