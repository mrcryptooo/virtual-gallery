import { expect, test } from '@playwright/test';

/**
 * M0.2 smoke spec: the built app boots and renders its heading.
 * Deliberately trivial — golden-path journeys arrive with their milestones.
 */
test('app boots and shows the heading', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Virtual Gallery');
  await expect(page.getByRole('heading', { level: 1, name: 'Virtual Gallery' })).toBeVisible();
});
