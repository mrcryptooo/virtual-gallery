import { afterEach, describe, expect, it, vi } from 'vitest';

const { GET: handler } = await import('./login.js');

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/auth/login', () => {
  it('returns 503 when X OAuth is not configured', async () => {
    vi.stubEnv('X_CLIENT_ID', '');
    const res = await handler(new Request('http://localhost/api/auth/login'));
    expect(res.status).toBe(503);
  });

  it('redirects to X authorize with PKCE + state params and sets the oauth cookie', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-123');
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const res = await handler(new Request('https://seismic-museum.vercel.app/api/auth/login'));
    expect(res.status).toBe(302);
    const location = res.headers.get('Location');
    expect(location).toBeTruthy();
    const url = new URL(location ?? '');
    expect(url.origin + url.pathname).toBe('https://x.com/i/oauth2/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://seismic-museum.vercel.app/api/auth/callback',
    );
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(res.headers.get('Set-Cookie')).toContain('seismic_oauth=');
  });

  it('rejects an absolute/external redirectTo (open-redirect guard)', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-123');
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const res = await handler(
      new Request(
        'https://seismic-museum.vercel.app/api/auth/login?redirectTo=https://evil.example/',
      ),
    );
    // The cookie carries the sanitized redirectTo; decode it to confirm
    // it fell back to "/" rather than the external URL.
    const setCookie = res.headers.get('Set-Cookie') ?? '';
    const match = /seismic_oauth=([^;]+)/.exec(setCookie);
    expect(match).toBeTruthy();
    const decoded = decodeURIComponent(match?.[1] ?? '');
    const [body] = decoded.split('.');
    const payload = JSON.parse(Buffer.from(body ?? '', 'base64url').toString('utf8')) as {
      redirectTo: string;
    };
    expect(payload.redirectTo).toBe('/');
  });
});
