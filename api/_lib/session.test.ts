import { afterEach, describe, expect, it, vi } from 'vitest';

const fromMock = vi.fn();
const supabaseClient = { from: fromMock };
vi.mock('./supabase.js', () => ({ getSupabase: () => supabaseClient }));

const {
  encodeSessionCookieValue,
  decodeSessionCookieValue,
  sessionCookieHeader,
  clearSessionCookieHeader,
  readCookie,
  getSessionUser,
} = await import('./session.js');

afterEach(() => {
  vi.unstubAllEnvs();
  fromMock.mockReset();
});

describe('cookie signing', () => {
  it('round-trips a session id through encode/decode', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const encoded = encodeSessionCookieValue('11111111-1111-1111-1111-111111111111');
    expect(decodeSessionCookieValue(encoded)).toBe('11111111-1111-1111-1111-111111111111');
  });

  it('rejects a tampered session id', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const encoded = encodeSessionCookieValue('11111111-1111-1111-1111-111111111111');
    const tampered = encoded.replace('1111', '2222');
    expect(decodeSessionCookieValue(tampered)).toBeNull();
  });

  it('rejects a value with no signature separator', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    expect(decodeSessionCookieValue('no-dot-here')).toBeNull();
  });

  it('produces different signatures under different secrets', () => {
    vi.stubEnv('SESSION_SECRET', 'secret-a');
    const encoded = encodeSessionCookieValue('id');
    vi.stubEnv('SESSION_SECRET', 'secret-b');
    expect(decodeSessionCookieValue(encoded)).toBeNull();
  });
});

describe('cookie headers', () => {
  it('sets HttpOnly, Secure, SameSite=Lax on the session cookie', () => {
    const header = sessionCookieHeader('abc', 3600);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Max-Age=3600');
  });

  it('clears the cookie with Max-Age=0', () => {
    expect(clearSessionCookieHeader()).toContain('Max-Age=0');
  });

  it('reads a cookie by name from a Cookie header', () => {
    const req = new Request('http://localhost/', {
      headers: { cookie: 'a=1; seismic_session=xyz' },
    });
    expect(readCookie(req, 'seismic_session')).toBe('xyz');
  });

  it('returns null when the cookie is absent', () => {
    const req = new Request('http://localhost/');
    expect(readCookie(req, 'seismic_session')).toBeNull();
  });
});

describe('getSessionUser', () => {
  function reqWithCookie(sessionId: string): Request {
    return new Request('http://localhost/', {
      headers: { cookie: `seismic_session=${encodeSessionCookieValue(sessionId)}` },
    });
  }

  it('returns null with no cookie at all', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    expect(await getSessionUser(new Request('http://localhost/'))).toBeNull();
  });

  it('returns null for a tampered cookie without querying the database', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const req = new Request('http://localhost/', {
      headers: { cookie: 'seismic_session=garbage' },
    });
    expect(await getSessionUser(req)).toBeNull();
    expect(fromMock).not.toHaveBeenCalled();
  });

  it('returns null when the session row is revoked', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 's1',
                user_id: 'u1',
                expires_at: new Date(Date.now() + 100000).toISOString(),
                revoked_at: new Date().toISOString(),
              },
              error: null,
            }),
        }),
      }),
    });
    expect(await getSessionUser(reqWithCookie('s1'))).toBeNull();
  });

  it('returns null when the session is expired', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    fromMock.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({
              data: {
                id: 's1',
                user_id: 'u1',
                expires_at: new Date(Date.now() - 1000).toISOString(),
                revoked_at: null,
              },
              error: null,
            }),
        }),
      }),
    });
    expect(await getSessionUser(reqWithCookie('s1'))).toBeNull();
  });

  it('returns the session + user for a valid, unexpired, unrevoked session', async () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    fromMock
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: {
                  id: 's1',
                  user_id: 'u1',
                  expires_at: new Date(Date.now() + 100000).toISOString(),
                  revoked_at: null,
                },
                error: null,
              }),
          }),
        }),
      })
      .mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: { id: 'u1', role: 'user' }, error: null }),
          }),
        }),
      });

    const result = await getSessionUser(reqWithCookie('s1'));
    expect(result?.user.id).toBe('u1');
    expect(result?.session.id).toBe('s1');
  });
});
