import { defineConfig } from 'vitest/config';

/** Pipeline unit tests (scripts/pipeline) — node environment, no DOM. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/pipeline/**/*.test.ts'],
    // Reprojection tests process real (small) images — allow headroom.
    testTimeout: 30000,
  },
});
