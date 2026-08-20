import { useEffect, useState } from 'react';

/** Mirrors the JSON shape api/auth/me.ts returns. */
export interface CurrentUser {
  id: string;
  xUsername: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: 'user' | 'admin';
  createdAt: string;
}

export type CurrentUserState =
  | { status: 'loading'; user: null }
  | { status: 'signed-out'; user: null }
  | { status: 'signed-in'; user: CurrentUser }
  | { status: 'error'; user: null };

/**
 * Client-side convenience only -- purely for what the UI shows (sign-in
 * link vs. avatar, redirecting a signed-out visitor away from /profile).
 * It is never the actual authorization boundary: every route that
 * matters (api/profile.ts, api/me/screenshots.ts, api/admin/*) re-checks
 * the real session server-side regardless of what this hook renders.
 */
export function useCurrentUser(): CurrentUserState {
  const [state, setState] = useState<CurrentUserState>({ status: 'loading', user: null });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((res) => res.json() as Promise<{ user: CurrentUser | null }>)
      .then((data) => {
        if (cancelled) return;
        setState(
          data.user
            ? { status: 'signed-in', user: data.user }
            : { status: 'signed-out', user: null },
        );
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', user: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
