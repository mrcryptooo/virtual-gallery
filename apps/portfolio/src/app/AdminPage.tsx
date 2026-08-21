import { useEffect, useMemo, useState } from 'react';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Scrim } from '@/components/ui/Scrim';
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

interface ScreenshotStats {
  total: number;
  /** Most-recent-first, capped at 7 days -- a quick-glance trend, not a
      full analytics chart (this project has no analytics service; see
      api/cron/daily-summary.ts's own comment on the same boundary). */
  perDay: { date: string; count: number }[];
}

function computeScreenshotStats(items: ScreenshotRecord[]): ScreenshotStats {
  const counts = new Map<string, number>();
  for (const shot of items) {
    const date = shot.createdAt.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
  }
  const perDay = Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);
  return { total: items.length, perDay };
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
  const [lightboxShot, setLightboxShot] = useState<ScreenshotRecord | null>(null);

  useEffect(() => {
    if (!lightboxShot) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxShot(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [lightboxShot]);

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
  const screenshotStats = useMemo(
    () => computeScreenshotStats(screenshots.status === 'ready' ? screenshots.items : []),
    [screenshots],
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
          <>
            <dl className={styles['screenshotStats']}>
              <div className={styles['screenshotStat']}>
                <dt>Total captured</dt>
                <dd>{screenshotStats.total}</dd>
              </div>
              {screenshotStats.perDay.map((day) => (
                <div key={day.date} className={styles['screenshotStat']}>
                  <dt>{day.date}</dt>
                  <dd>{day.count}</dd>
                </div>
              ))}
            </dl>
            <ul className={styles['screenshotGrid']}>
              {(screenshots.status === 'ready' ? screenshots.items : []).map((s) => (
                <li key={s.id} className={styles['screenshotGridItem']}>
                  <button
                    type="button"
                    className={styles['screenshotGridButton']}
                    onClick={() => {
                      setLightboxShot(s);
                    }}
                  >
                    <img
                      src={s.media.url}
                      alt={`Captured artwork: ${s.panoramaTitle}`}
                      loading="lazy"
                    />
                  </button>
                  <div className={styles['screenshotGridMeta']}>
                    <span className={styles['listItemPrimary']}>{s.panoramaTitle}</span>
                    <span className={styles['listItemMeta']}>
                      {s.projectId} &middot; {s.template ?? 'no template'} &middot;{' '}
                      {s.userId ?? 'anonymous'} &middot; {new Date(s.createdAt).toLocaleString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>

      {lightboxShot && (
        <div className={styles['lightbox']}>
          <Scrim
            onDismiss={() => {
              setLightboxShot(null);
            }}
          />
          <Panel raised className={styles['lightboxPanel']}>
            <IconButton
              label="Close"
              className={styles['lightboxClose']}
              onClick={() => {
                setLightboxShot(null);
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6L18 18M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
            <img
              className={styles['lightboxImage']}
              src={lightboxShot.media.url}
              alt={`Captured artwork: ${lightboxShot.panoramaTitle}`}
            />
            <div className={styles['lightboxMeta']}>
              <p className={styles['lightboxTitle']}>{lightboxShot.panoramaTitle}</p>
              <p className={styles['lightboxDate']}>
                {lightboxShot.projectId} &middot; {lightboxShot.template ?? 'no template'} &middot;{' '}
                {lightboxShot.userId ?? 'anonymous'} &middot;{' '}
                {new Date(lightboxShot.createdAt).toLocaleString()}
              </p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
