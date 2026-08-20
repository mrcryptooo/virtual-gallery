import { afterEach, describe, expect, it, vi } from 'vitest';
import { encodeOAuthCookie } from '../_lib/oauth.js';

const { exchangeCodeForXProfileMock } = vi.hoisted(() => ({
  exchangeCodeForXProfileMock: vi.fn(),
}));
vi.mock('../_lib/oauth.js', async () => {
  const actual = await vi.importActual<typeof import('../_lib/oauth.js')>('../_lib/oauth.js');
  return { ...actual, exchangeCodeForXProfile: exchangeCodeForXProfileMock };
});

const fromMock = vi.fn();
vi.mock('../_lib/supabase.js', () => ({ getSupabase: () => ({ from: fromMock }) }));

const createSessionMock = vi.fn(() => Promise.resolve('signed-session-cookie'));
vi.mock('../_lib/session.js', () => ({
  createSession: createSessionMock,
  sessionCookieHeader: (v: string) => `seismic_session=${v}`,
}));

const { handleCallback: handler } = await import('./callback.js');

function requestWithOAuthCookie(
  params: Record<string, string>,
  cookiePayload: { state: string; verifier: string; redirectTo: string } | null,
): Request {
  const url = new URL('https://seismic-museum.vercel.app/api/auth/callback');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (cookiePayload) {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    headers.cookie = `seismic_oauth=${encodeOAuthCookie(cookiePayload)}`;
  }
  return new Request(url.toString(), { headers });
}

afterEach(() => {
  vi.unstubAllEnvs();
  exchangeCodeForXProfileMock.mockReset();
  fromMock.mockReset();
  createSessionMock.mockClear();
});

describe('GET /api/auth/callback', () => {
  it('redirects with auth_error=denied when X reports an error param', async () => {
    const res = await handler(requestWithOAuthCookie({ error: 'access_denied' }, null));
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/?auth_error=denied');
  });

  it('rejects when there is no oauth cookie at all', async () => {
    const res = await handler(requestWithOAuthCookie({ code: 'c', state: 's' }, null));
    expect(res.headers.get('Location')).toBe('/?auth_error=invalid_state');
  });

  it('rejects when the returned state does not match the cookie (CSRF)', async () => {
    const res = await handler(
      requestWithOAuthCookie(
        { code: 'c', state: 'wrong-state' },
        { state: 'expected-state', verifier: 'v', redirectTo: '/' },
      ),
    );
    expect(res.headers.get('Location')).toBe('/?auth_error=invalid_state');
    expect(exchangeCodeForXProfileMock).not.toHaveBeenCalled();
  });

  it('creates a new user, a real session, and redirects on first login', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    exchangeCodeForXProfileMock.mockResolvedValue({
      id: 'x-123',
      username: 'ada',
      name: 'Ada Lovelace',
      profileImageUrl: 'https://pbs.twimg.com/ada.jpg',
    });
    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      })
      .mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => ({
              overrideTypes: () => Promise.resolve({ data: { id: 'user-1' }, error: null }),
            }),
          }),
        }),
      });

    const res = await handler(
      requestWithOAuthCookie(
        { code: 'c', state: 'expected-state' },
        { state: 'expected-state', verifier: 'v', redirectTo: '/profile' },
      ),
    );

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/profile');
    expect(createSessionMock).toHaveBeenCalledWith('user-1', null);
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.includes('seismic_session='))).toBe(true);
  });

  it('promotes the configured INITIAL_ADMIN_X_USER_ID to admin on first login', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    vi.stubEnv('INITIAL_ADMIN_X_USER_ID', 'x-123');
    exchangeCodeForXProfileMock.mockResolvedValue({
      id: 'x-123',
      username: 'ada',
      name: 'Ada Lovelace',
      profileImageUrl: null,
    });
    let insertedRole: string | undefined;
    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      })
      .mockReturnValueOnce({
        insert: (row: { role: string }) => {
          insertedRole = row.role;
          return {
            select: () => ({
              single: () => ({
                overrideTypes: () => Promise.resolve({ data: { id: 'user-1' }, error: null }),
              }),
            }),
          };
        },
      });

    await handler(
      requestWithOAuthCookie(
        { code: 'c', state: 'expected-state' },
        { state: 'expected-state', verifier: 'v', redirectTo: '/' },
      ),
    );

    expect(insertedRole).toBe('admin');
  });

  it('redirects with a server_error on token exchange failure', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    exchangeCodeForXProfileMock.mockRejectedValue(new Error('boom'));

    const res = await handler(
      requestWithOAuthCookie(
        { code: 'c', state: 'expected-state' },
        { state: 'expected-state', verifier: 'v', redirectTo: '/' },
      ),
    );
    expect(res.headers.get('Location')).toBe('/?auth_error=exchange_failed');
  });
});
