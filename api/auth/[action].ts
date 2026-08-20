import { handleCallback } from './callback.js';
import { handleLogin } from './login.js';
import { handleLogout } from './logout.js';
import { handleMe } from './me.js';

/**
 * Single dynamic route standing in for four separate files
 * (login/callback/logout/me), which is why each of those exports a plain
 * `handle*` function instead of `GET` -- Vercel only auto-registers a
 * Function for files that export a recognized HTTP-method handler, so
 * four GET exports would have been four Functions. The Hobby plan caps a
 * deployment at 12 Functions total; this project's route count crossed
 * that once the real auth/profile/admin work landed, so this file (and
 * api/admin/[resource].ts) fold four-and three-file groups down to one
 * Function each. The URLs the frontend calls (/api/auth/login,
 * /api/auth/callback, /api/auth/logout, /api/auth/me) are unchanged --
 * this only changes how many separate Vercel Functions serve them.
 */
export async function GET(request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.split('/').pop();
  switch (action) {
    case 'login':
      return handleLogin(request);
    case 'callback':
      return handleCallback(request);
    case 'logout':
      return handleLogout(request);
    case 'me':
      return handleMe(request);
    default:
      return Response.json({ error: 'Not found' }, { status: 404 });
  }
}
