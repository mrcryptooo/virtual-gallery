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

/**
 * Portrait navigation guarantee (owner requirement, 2026-07-31): a phone held
 * upright has a far narrower horizontal field of view, which used to leave
 * scenes with no visible way onward. Exhaustive per-scene coverage lives in
 * the HotspotLayer component tests; this is the real-browser confirmation
 * that the layer renders discoverable controls in a portrait viewport.
 */
test('a walkthrough offers a navigation control in a portrait viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/p/museum-test');

  // The scene title appears once the first panorama is live.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });

  const controls = page.getByRole('button');
  await expect(controls.first()).toBeVisible({ timeout: 30_000 });
  expect(await controls.count()).toBeGreaterThan(0);

  // Whatever form it takes, its accessible name must say where it goes.
  await expect(controls.first()).toHaveAccessibleName(/\S/);
});
