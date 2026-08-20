import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  callbackUrlFor,
  clearOAuthCookieHeader,
  decodeOAuthCookie,
  encodeOAuthCookie,
  generatePkcePair,
  generateState,
  oauthCookieHeader,
  readOAuthCookie,
} from './_oauth.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('PKCE', () => {
  it('generates a verifier and an S256 challenge derived from it', () => {
    const { verifier, challenge } = generatePkcePair();
    expect(verifier.length).toBeGreaterThan(20);
    expect(challenge.length).toBeGreaterThan(20);
    expect(challenge).not.toBe(verifier);
  });

  it('generates a fresh verifier/challenge pair every call', () => {
    const a = generatePkcePair();
    const b = generatePkcePair();
    expect(a.verifier).not.toBe(b.verifier);
  });

  it('generates a fresh state token every call', () => {
    expect(generateState()).not.toBe(generateState());
  });
});

describe('oauth cookie', () => {
  it('round-trips state/verifier/redirectTo through encode/decode', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const payload = { state: 's', verifier: 'v', redirectTo: '/profile' };
    const encoded = encodeOAuthCookie(payload);
    expect(decodeOAuthCookie(encoded)).toEqual(payload);
  });

  it('rejects a tampered cookie', () => {
    vi.stubEnv('SESSION_SECRET', 'test-secret');
    const encoded = encodeOAuthCookie({ state: 's', verifier: 'v', redirectTo: '/' });
    expect(decodeOAuthCookie(encoded.slice(0, -2) + 'xx')).toBeNull();
  });

  it('returns null for a null/absent cookie', () => {
    expect(decodeOAuthCookie(null)).toBeNull();
  });

  it('sets HttpOnly/Secure/SameSite=Lax scoped to /api/auth', () => {
    const header = oauthCookieHeader('value');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/api/auth');
  });

  it('clears with Max-Age=0', () => {
    expect(clearOAuthCookieHeader()).toContain('Max-Age=0');
  });

  it('reads the oauth cookie by name from a Cookie header', () => {
    const req = new Request('http://localhost/', {
      headers: { cookie: 'seismic_oauth=abc123' },
    });
    expect(readOAuthCookie(req)).toBe('abc123');
  });
});

describe('callbackUrlFor', () => {
  it('derives the callback URL from the request origin', () => {
    const req = new Request('https://seismic-museum.vercel.app/api/auth/login');
    expect(callbackUrlFor(req)).toBe('https://seismic-museum.vercel.app/api/auth/callback');
  });
});
