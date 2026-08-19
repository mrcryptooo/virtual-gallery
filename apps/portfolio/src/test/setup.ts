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
