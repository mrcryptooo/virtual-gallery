import { defineConfig, devices } from '@playwright/test';

/**
 * E2E configuration (M0.2). Safari is a first-class target (contract §13),
 * so webkit failures block merge exactly like chromium failures.
 * Specs run against the production build via `vite preview`.
 */
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command:
      'pnpm --filter @virtual-gallery/portfolio build && pnpm --filter @virtual-gallery/portfolio preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
