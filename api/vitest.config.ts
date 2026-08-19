import { defineConfig } from 'vitest/config';

/** Serverless API route unit tests — node environment, no DOM. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['api/**/*.test.ts'],
  },
});
