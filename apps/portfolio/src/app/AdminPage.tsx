import { useEffect, useState } from 'react';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import type { ScreenshotRecord, SubmissionRecord } from '@/lib/community/types';
import styles from './AdminPage.module.css';

interface AdminUser {
  id: string;
  x_username: string;
  display_name: string;
  role: 'user' | 'admin';
  created_at: string;
}

type Tab = 'users' | 'submissions' | 'screenshots';

type FetchState<T> =
  | { status: 'loading' }
  | { status: 'ready'; items: T[] }
  | { status: 'error' }
  | { status: 'forbidden' };

function useAdminList<T>(path: string, active: boolean): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({ status: 'loading' });

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setState({ status: 'loading' });
    fetch(path)
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setState({ status: 'forbidden' });
          return;
        }
        if (!res.ok) {
          if (!cancelled) setState({ status: 'error' });
          return;
        }
        const data = (await res.json()) as Record<string, unknown>;
        const key = Object.keys(data).find((k) => Array.isArray(data[k]));
        const items = key ? (data[key] as T[]) : [];
        if (!cancelled) setState({ status: 'ready', items });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [path, active]);

  return state;
}

/**
 * `/admin` -- real server-side RBAC (Phase 7). This page itself is only a
 * UI convenience: every list here comes from an admin API route
 * (api/admin/{users,submissions,screenshots}.ts) that independently
 * re-verifies the session and role on every request. A visitor who is
 * not an admin sees the same "not authorized" state here whether or not
 * they can read this component's source -- hiding a button is not the
 * access control, the 401/403 from the server is.
 */
export function AdminPage() {
  const currentUser = useCurrentUser();
  const [tab, setTab] = useState<Tab>('users');

  const isAdmin = currentUser.status === 'signed-in' && currentUser.user.role === 'admin';

  const users = useAdminList<AdminUser>('/api/admin/users', isAdmin && tab === 'users');
  const submissions = useAdminList<SubmissionRecord>(
    '/api/admin/submissions',
    isAdmin && tab === 'submissions',
  );
  const screenshots = useAdminList<ScreenshotRecord>(
    '/api/admin/screenshots',
    isAdmin && tab === 'screenshots',
  );

  if (currentUser.status === 'loading') {
    return (
      <div className={styles['page']}>
        <SiteHeader />
        <main className={styles['stage']}>
          <p className={styles['status']} role="status">
            Loading&hellip;
          </p>
        </main>
      </div>
    );
  }

  if (currentUser.status !== 'signed-in') {
    return (
      <div className={styles['page']}>
        <SiteHeader />
        <main className={styles['stage']}>
          <p className={styles['eyebrow']}>Seismic Museum</p>
          <h1 className={styles['title']}>Admin</h1>
          <p className={styles['body']} role="alert">
            You need to sign in with an admin account to view this page.
          </p>
          <a className={styles['cta']} href="/api/auth/login?redirectTo=%2Fadmin">
            Sign in with X
          </a>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className={styles['page']}>
        <SiteHeader />
        <main className={styles['stage']}>
          <p className={styles['eyebrow']}>Seismic Museum</p>
          <h1 className={styles['title']}>Admin</h1>
          <p className={styles['body']} role="alert">
            Your account does not have admin access.
          </p>
        </main>
      </div>
    );
  }

  const active = tab === 'users' ? users : tab === 'submissions' ? submissions : screenshots;

  return (
    <div className={styles['page']}>
      <SiteHeader />
      <main className={styles['stage']}>
        <p className={styles['eyebrow']}>Seismic Museum</p>
        <h1 className={styles['title']}>Admin</h1>

        <nav className={styles['tabs']} aria-label="Admin sections">
          {(['users', 'submissions', 'screenshots'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={styles['tab']}
              aria-current={tab === t ? 'page' : undefined}
              onClick={() => {
                setTab(t);
              }}
            >
              {t === 'users' ? 'Users' : t === 'submissions' ? 'Submissions' : 'Screenshots'}
            </button>
          ))}
        </nav>

        {active.status === 'loading' && (
          <p className={styles['status']} role="status">
            Loading&hellip;
          </p>
        )}
        {active.status === 'forbidden' && (
          <p className={styles['status']} role="alert">
            Not authorized to view this.
          </p>
        )}
        {active.status === 'error' && (
          <p className={styles['status']} role="alert">
            Could not load this list right now.
          </p>
        )}
        {active.status === 'ready' && active.items.length === 0 && (
          <p className={styles['status']}>Nothing here yet.</p>
        )}

        {active.status === 'ready' && active.items.length > 0 && tab === 'users' && (
          <ul className={styles['list']}>
            {(users.status === 'ready' ? users.items : []).map((u) => (
              <li key={u.id} className={styles['listItem']}>
                <span className={styles['listItemPrimary']}>{u.display_name}</span>
                <span className={styles['listItemMeta']}>
                  @{u.x_username} &middot; {u.role}
                </span>
              </li>
            ))}
          </ul>
        )}

        {active.status === 'ready' && active.items.length > 0 && tab === 'submissions' && (
          <ul className={styles['list']}>
            {(submissions.status === 'ready' ? submissions.items : []).map((s) => (
              <li key={s.id} className={styles['listItem']}>
                <span className={styles['listItemPrimary']}>{s.artworkTitle}</span>
                <span className={styles['listItemMeta']}>
                  {s.artistName} &middot; {s.status} &middot;{' '}
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}

        {active.status === 'ready' && active.items.length > 0 && tab === 'screenshots' && (
          <ul className={styles['list']}>
            {(screenshots.status === 'ready' ? screenshots.items : []).map((s) => (
              <li key={s.id} className={styles['listItem']}>
                <span className={styles['listItemPrimary']}>{s.panoramaId}</span>
                <span className={styles['listItemMeta']}>
                  {s.userId ?? 'anonymous'} &middot; {new Date(s.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
