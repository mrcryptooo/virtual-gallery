import { getSessionUser } from './_lib/session.js';
import { getSupabase } from './_lib/supabase.js';

/**
 * PATCH /api/profile -- update the signed-in user's own editable fields
 * (display name, bio). Ownership is derived entirely from the session,
 * never from a client-supplied user id -- there is no id field this
 * route will even look at in the body.
 */

const MAX_DISPLAY_NAME = 100;
const MAX_BIO = 500;

interface ProfileInput {
  displayName?: unknown;
  bio?: unknown;
}

function str(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function PATCH(request: Request): Promise<Response> {
  const sessionUser = await getSessionUser(request);
  if (!sessionUser) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let input: ProfileInput;
  try {
    input = (await request.json()) as ProfileInput;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const displayName = str(input.displayName, MAX_DISPLAY_NAME);
  if (!displayName) {
    return Response.json({ error: 'Display name is required.' }, { status: 400 });
  }
  const bio = str(input.bio, MAX_BIO);

  const supabase = getSupabase();
  if (!supabase) {
    return Response.json({ error: 'Database is not configured.' }, { status: 500 });
  }

  const { error } = await supabase
    .from('users')
    .update({ display_name: displayName, bio: bio || null })
    .eq('id', sessionUser.user.id);

  if (error) {
    console.error('PATCH /api/profile: update failed', error);
    return Response.json({ error: 'Could not update your profile right now.' }, { status: 500 });
  }

  return Response.json({ ok: true });
}
