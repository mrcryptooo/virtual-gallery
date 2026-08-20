import { handleScreenshots } from './_screenshots.js';
import { handleSubmissions } from './_submissions.js';
import { handleUsers } from './_users.js';

/**
 * Single dynamic route standing in for three separate files
 * (users/submissions/screenshots) -- see api/auth/[action].ts's header
 * comment for the full reasoning (Vercel's Hobby-plan 12-Function limit).
 * The URLs the frontend calls (/api/admin/users, /api/admin/submissions,
 * /api/admin/screenshots) are unchanged.
 */
export async function GET(request: Request): Promise<Response> {
  const resource = new URL(request.url).pathname.split('/').pop();
  switch (resource) {
    case 'users':
      return handleUsers(request);
    case 'submissions':
      return handleSubmissions(request);
    case 'screenshots':
      return handleScreenshots(request);
    default:
      return Response.json({ error: 'Not found' }, { status: 404 });
  }
}
