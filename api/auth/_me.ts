import { getSessionUser } from '../_lib/_session.js';

/**
 * GET /api/auth/me -- current session's profile, or `{ user: null }`.
 * Always 200 (auth state is not an error) so the frontend can render a
 * signed-out state without special-casing a 401 on every page load.
 *
 * Dispatched from api/auth/[action].ts, not exported as GET directly --
 * see that file's header comment (Vercel's Hobby-plan Function limit).
 */
export async function handleMe(request: Request): Promise<Response> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json({ user: null });
  }
  const { id, x_username, display_name, avatar_url, bio, role, created_at } = sessionUser.user;
  return Response.json({
    user: {
      id,
      xUsername: x_username,
      displayName: display_name,
      avatarUrl: avatar_url,
      bio,
      role,
      createdAt: created_at,
    },
  });
}
