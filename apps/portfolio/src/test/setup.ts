import '@testing-library/jest-dom/vitest';
import { expect, vi } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';

expect.extend(axeMatchers);

// jsdom has no matchMedia implementation. Components that check
// prefers-reduced-motion (the Seismic Stone hero, the landing page entrance)
// need this to exist at all; default to "no preference" (matches: false) so
// tests exercise the normal-motion path unless a test opts in otherwise.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

// SiteHeader (rendered by nearly every page) calls /api/auth/me on mount
// via useCurrentUser -- default every test to "signed out" so pages that
// don't care about auth state don't need their own fetch mock just to
// avoid an unhandled network call in jsdom. Tests that DO care (auth
// flows, SiteHeader's own tests) override global.fetch themselves, which
// takes precedence over this default.
const originalFetch = global.fetch;
global.fetch = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/auth/me')) {
    return Promise.resolve(new Response(JSON.stringify({ user: null }), { status: 200 }));
  }
  return originalFetch(input, init);
});
