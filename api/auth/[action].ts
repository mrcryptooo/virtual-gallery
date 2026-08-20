import { handleCallback } from './_callback.js';
import { handleLogin } from './_login.js';
import { handleLogout } from './_logout.js';
import { handleMe } from './_me.js';

/**
 * Single dynamic route standing in for four separate files
 * (login/callback/logout/me). Vercel deploys every file under api/ as its
 * own Function regardless of what it exports -- the only thing that
 * excludes a file is its own filename starting with `_` (see
 * https://vercel.com/docs/functions/configuring-functions/advanced-configuration#adding-utility-files-to-the-/api-directory).
 * That's why the four files this dispatches to are named _login.ts,
 * _callback.ts, _logout.ts, _me.ts and export a plain `handle*` function
 * instead of `GET` directly -- an underscore-less file exporting GET
 * would still be its own Function even with a name nothing points at.
 * The Hobby plan caps a deployment at 12 Functions total; this project's
 * route count crossed that once the real auth/profile/admin work landed,
 * so this file (and api/admin/[resource].ts) fold four- and three-file
 * groups down to one Function each. The URLs the frontend calls
 * (/api/auth/login, /api/auth/callback, /api/auth/logout, /api/auth/me)
 * are unchanged -- this only changes how many separate Vercel Functions
 * serve them.
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
