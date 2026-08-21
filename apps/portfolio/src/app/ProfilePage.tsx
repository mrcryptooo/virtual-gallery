import { useCallback, useEffect, useState } from 'react';
import { SiteHeader } from '@/components/nav/SiteHeader';
import { IconButton } from '@/components/ui/IconButton';
import { Panel } from '@/components/ui/Panel';
import { Scrim } from '@/components/ui/Scrim';
import { useCurrentUser } from '@/lib/auth/useCurrentUser';
import type { ScreenshotRecord } from '@/lib/community/types';
import styles from './ProfilePage.module.css';

function formatCaptureDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

type GalleryState =
  | { status: 'loading' }
  | { status: 'ready'; screenshots: ScreenshotRecord[] }
  | { status: 'error' };

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * `/profile` -- real, database-backed identity (Phase 6). The X identity
 * (avatar/display name) is only the *initial* value: displayName and bio
 * are editable here and persisted via PATCH /api/profile, which derives
 * the target row from the session -- never from anything this page sends
 * as an id. Gallery is the signed-in user's own museum screenshots
 * (GET /api/me/screenshots, same server-side ownership filter).
 */
export function ProfilePage() {
  const currentUser = useCurrentUser();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [gallery, setGallery] = useState<GalleryState>({ status: 'loading' });
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

  useEffect(() => {
    if (currentUser.status === 'signed-in') {
      setDisplayName(currentUser.user.displayName);
      setBio(currentUser.user.bio ?? '');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser.status !== 'signed-in') return;
    let cancelled = false;
    fetch('/api/me/screenshots')
      .then((res) => res.json() as Promise<{ screenshots: ScreenshotRecord[] }>)
      .then((data) => {
        if (!cancelled) setGallery({ status: 'ready', screenshots: data.screenshots });
      })
      .catch(() => {
        if (!cancelled) setGallery({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser.status]);

  const handleSave = useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSaveState('saving');
      try {
        const res = await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName, bio }),
        });
        setSaveState(res.ok ? 'saved' : 'error');
      } catch {
        setSaveState('error');
      }
    },
    [displayName, bio],
  );

  if (currentUser.status === 'loading') {
    return (
      <div className={styles['page']}>
        <SiteHeader />
        <main className={styles['stage']}>
          <p className={styles['status']} role="status">
            Loading your profile&hellip;
          </p>
        </main>
      </div>
    );
  }

  if (currentUser.status === 'signed-out' || currentUser.status === 'error') {
    return (
      <div className={styles['page']}>
        <SiteHeader />
        <main className={styles['stage']}>
          <p className={styles['eyebrow']}>Seismic Museum</p>
          <h1 className={styles['title']}>You&rsquo;re not signed in</h1>
          <p className={styles['body']}>Sign in with X to create and edit your profile.</p>
          <a className={styles['cta']} href="/api/auth/login?redirectTo=%2Fprofile">
            Sign in with X
          </a>
        </main>
      </div>
    );
  }

  const { user } = currentUser;

  return (
    <div className={styles['page']}>
      <SiteHeader />
      <main className={styles['stage']}>
        <div className={styles['identity']}>
          {user.avatarUrl ? (
            <img className={styles['avatar']} src={user.avatarUrl} alt="" width={72} height={72} />
          ) : (
            <span className={styles['avatarFallback']} aria-hidden="true">
              {user.displayName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className={styles['title']}>{user.displayName}</h1>
            <p className={styles['username']}>@{user.xUsername}</p>
          </div>
        </div>

        <form className={styles['form']} onSubmit={(event) => void handleSave(event)}>
          <label className={styles['field']}>
            <span className={styles['label']}>Display name</span>
            <input
              type="text"
              required
              maxLength={100}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
              }}
            />
          </label>
          <label className={styles['field']}>
            <span className={styles['label']}>Bio</span>
            <textarea
              rows={3}
              maxLength={500}
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
              }}
            />
          </label>
          <div className={styles['formFooter']}>
            <button
              type="submit"
              className={styles['saveButton']}
              disabled={saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save changes'}
            </button>
            {saveState === 'saved' && (
              <span className={styles['saveStatus']} role="status">
                Saved.
              </span>
            )}
            {saveState === 'error' && (
              <span className={styles['saveError']} role="alert">
                Could not save. Please try again.
              </span>
            )}
          </div>
        </form>

        <section className={styles['gallerySection']}>
          <h2 className={styles['galleryTitle']}>Your museum captures</h2>
          {gallery.status === 'loading' && (
            <p className={styles['status']} role="status">
              Loading your gallery&hellip;
            </p>
          )}
          {gallery.status === 'error' && (
            <p className={styles['status']} role="alert">
              Could not load your gallery right now.
            </p>
          )}
          {gallery.status === 'ready' && gallery.screenshots.length === 0 && (
            <p className={styles['status']}>
              No screenshots yet &mdash; capture one from the museum&rsquo;s camera control.
            </p>
          )}
          {gallery.status === 'ready' && gallery.screenshots.length > 0 && (
            <ul className={styles['gallery']}>
              {gallery.screenshots.map((shot) => (
                <li key={shot.id} className={styles['galleryItem']}>
                  <button
                    type="button"
                    className={styles['galleryItemButton']}
                    onClick={() => {
                      setLightboxShot(shot);
                    }}
                  >
                    <img
                      src={shot.media.url}
                      alt={`Museum capture: ${shot.panoramaTitle}`}
                      loading="lazy"
                    />
                    <span className={styles['galleryMeta']}>
                      <span className={styles['galleryMetaTitle']}>{shot.panoramaTitle}</span>
                      <span className={styles['galleryMetaDate']}>
                        {formatCaptureDate(shot.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <a className={styles['back']} href="/api/auth/logout">
          Sign out
        </a>
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
              alt={`Museum capture: ${lightboxShot.panoramaTitle}`}
            />
            <div className={styles['lightboxMeta']}>
              <p className={styles['lightboxTitle']}>{lightboxShot.panoramaTitle}</p>
              <p className={styles['lightboxDate']}>{formatCaptureDate(lightboxShot.createdAt)}</p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
