import { expect, test } from '@playwright/test';

/**
 * The modern-museum tour is the Marzipano export served at /p/modern-museum.
 * These checks run against the production build, so they also prove the
 * rewrite and the <base> path resolve every asset under the public route.
 */

const VIEWPORTS = [
  { name: '390x844 portrait', width: 390, height: 844 },
  { name: '430x932 portrait', width: 430, height: 932 },
  { name: '844x390 landscape', width: 844, height: 390 },
  { name: '768x1024 tablet portrait', width: 768, height: 1024 },
  { name: '1366x768 desktop landscape', width: 1366, height: 768 },
];

test('the Marzipano tour boots at /p/modern-museum with all assets served', async ({ page }) => {
  const failed: string[] = [];
  const consoleErrors: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${String(r.status())} ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto('/p/modern-museum');
  await page.waitForFunction(
    () => document.querySelectorAll('#pano canvas').length > 0,
    undefined,
    {
      timeout: 45_000,
    },
  );

  const state = await page.evaluate(() => ({
    scenes:
      (window as unknown as { APP_DATA?: { scenes: unknown[] } }).APP_DATA?.scenes.length ?? 0,
    marzipano: typeof (window as unknown as { Marzipano?: unknown }).Marzipano,
    sceneName: document.querySelector('.sceneName')?.textContent ?? '',
    hotspots: document.querySelectorAll('.link-hotspot').length,
    fullscreen: document.querySelectorAll('#fullscreenToggle').length,
  }));

  expect(state.scenes).toBe(33);
  expect(state.marzipano).toBe('object');
  expect(state.hotspots).toBeGreaterThan(0);
  expect(state.fullscreen).toBe(1);
  expect(state.sceneName.trim()).not.toBe('');
  expect(failed, `failed requests:\n${failed.join('\n')}`).toEqual([]);
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('a link hotspot navigates to its authored destination', async ({ page }) => {
  await page.goto('/p/modern-museum');
  await page.waitForFunction(
    () => document.querySelectorAll('.link-hotspot').length > 0,
    undefined,
    {
      timeout: 45_000,
    },
  );

  // Resolve the first hotspot's authored target from the export's own data,
  // then assert the viewer lands on exactly that scene.
  const expected = await page.evaluate(() => {
    const data = (
      window as unknown as {
        APP_DATA: { scenes: { id: string; name: string; linkHotspots: { target: string }[] }[] };
      }
    ).APP_DATA;
    const target = data.scenes[0]?.linkHotspots[0]?.target;
    return data.scenes.find((s) => s.id === target)?.name ?? '';
  });

  await page.locator('.link-hotspot').first().click();
  await expect(page.locator('.sceneName')).toHaveText(expected, { timeout: 20_000 });
});

for (const vp of VIEWPORTS) {
  test(`tour is usable at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/p/modern-museum');
    await page.waitForFunction(
      () => document.querySelectorAll('#pano canvas').length > 0,
      undefined,
      { timeout: 45_000 },
    );

    const canvas = page.locator('#pano canvas').first();
    await expect(canvas).toBeVisible();

    // The panorama must fill the viewport and must not make the page scroll.
    const layout = await page.evaluate(() => ({
      panoWidth: document.querySelector('#pano')?.clientWidth ?? 0,
      panoHeight: document.querySelector('#pano')?.clientHeight ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    expect(layout.panoWidth).toBeGreaterThan(vp.width * 0.9);
    expect(layout.panoHeight).toBeGreaterThan(vp.height * 0.5);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);

    // Dragging must rotate the view rather than scroll the page.
    const before = await page.evaluate(() => document.querySelector('.sceneName')?.textContent);
    await canvas.hover();
    await page.mouse.down();
    await page.mouse.move(vp.width / 2 + 120, vp.height / 2, { steps: 8 });
    await page.mouse.up();
    const after = await page.evaluate(() => ({
      scene: document.querySelector('.sceneName')?.textContent,
      scrollY: window.scrollY,
    }));
    expect(after.scene).toBe(before);
    expect(after.scrollY).toBe(0);
  });
}
