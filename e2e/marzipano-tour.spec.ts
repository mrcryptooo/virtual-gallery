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

/**
 * The export's viewport meta uses vendor keys that some engines log about.
 * That tag is part of the authored export and is not ours to change, so these
 * specific notices are not treated as errors.
 */
const BENIGN_CONSOLE = /Viewport argument key .* not recognized and ignored/i;

const waitForViewer = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => document.querySelectorAll('#pano canvas').length > 0, undefined, {
    timeout: 60_000,
  });

test('the Marzipano tour boots at /p/modern-museum with all assets served', async ({ page }) => {
  const failed: string[] = [];
  const consoleErrors: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${String(r.status())} ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) consoleErrors.push(m.text());
  });

  await page.goto('/p/modern-museum');
  await waitForViewer(page);

  const state = await page.evaluate(() => ({
    scenes:
      (window as unknown as { APP_DATA?: { scenes: unknown[] } }).APP_DATA?.scenes.length ?? 0,
    marzipano: typeof (window as unknown as { Marzipano?: unknown }).Marzipano,
    sceneName: document.querySelector('.sceneName')?.textContent ?? '',
    hotspots: document.querySelectorAll('.link-hotspot').length,
    fullscreen: document.querySelectorAll('#fullscreenToggle').length,
    autorotate: document.querySelectorAll('#autorotateToggle').length,
  }));

  expect(state.scenes).toBe(33);
  expect(state.marzipano).toBe('object');
  expect(state.hotspots).toBeGreaterThan(0);
  expect(state.fullscreen).toBe(1);
  expect(state.autorotate).toBe(1);
  expect(state.sceneName.trim()).not.toBe('');
  expect(failed, `failed requests:\n${failed.join('\n')}`).toEqual([]);
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('a link hotspot navigates to its authored destination', async ({ page }) => {
  await page.goto('/p/modern-museum');
  await waitForViewer(page);
  await page.waitForFunction(() => document.querySelectorAll('.link-hotspot').length > 0);

  // Marzipano positions hotspots with 3D transforms and hides the ones facing
  // away, so drive the click through the DOM rather than a pointer at a
  // computed screen position. The destination comes from the export's own data.
  const expected = await page.evaluate(() => {
    const data = (
      window as unknown as {
        APP_DATA: { scenes: { id: string; name: string; linkHotspots: { target: string }[] }[] };
      }
    ).APP_DATA;
    const target = data.scenes[0]?.linkHotspots[0]?.target;
    const name = data.scenes.find((s) => s.id === target)?.name ?? '';
    document.querySelectorAll<HTMLElement>('.link-hotspot')[0]?.click();
    return name;
  });

  await expect(page.locator('.sceneName')).toHaveText(expected, { timeout: 30_000 });
});

test('the scene list reaches the last authored scene', async ({ page }) => {
  await page.goto('/p/modern-museum');
  await waitForViewer(page);

  const expected = await page.evaluate(() => {
    const data = (window as unknown as { APP_DATA: { scenes: { id: string; name: string }[] } })
      .APP_DATA;
    const last = data.scenes[data.scenes.length - 1];
    document.querySelector<HTMLElement>(`[data-id="${last?.id ?? ''}"]`)?.click();
    return last?.name ?? '';
  });

  await expect(page.locator('.sceneName')).toHaveText(expected, { timeout: 30_000 });
});

test('the bottom navigator has 33 correctly-mapped thumbnails and navigates on click', async ({
  page,
}) => {
  await page.goto('/p/modern-museum');
  await waitForViewer(page);
  await page.waitForFunction(() => document.querySelectorAll('.sceneThumb').length === 33);

  const mapping = await page.evaluate(() => {
    const thumbs = Array.from(document.querySelectorAll('.sceneThumb'));
    return thumbs.map((t) => {
      const img = t.querySelector<HTMLElement>('.sceneThumb-image');
      const bg = img ? getComputedStyle(img).backgroundImage : '';
      return {
        dataId: t.getAttribute('data-id'),
        ariaLabel: t.getAttribute('aria-label'),
        bgUrl: bg.replace(/^url\("?/, '').replace(/"?\)$/, ''),
      };
    });
  });

  // All 33 scenes present, each with its own distinct thumbnail image, and
  // every thumbnail's image genuinely comes from that same scene's own
  // tile directory -- not a placeholder or a repeated/duplicated image.
  expect(mapping).toHaveLength(33);
  expect(new Set(mapping.map((m) => m.dataId)).size).toBe(33);
  expect(new Set(mapping.map((m) => m.bgUrl)).size).toBe(33);
  for (const m of mapping) {
    expect(m.bgUrl).toContain(`/${m.dataId ?? ''}/`);
    expect(m.ariaLabel?.trim()).not.toBe('');
  }

  // Clicking a thumbnail navigates to exactly that scene (engine
  // navigation, not a page reload) and updates the active state.
  const targetIndex = 14;
  const targetId = mapping[targetIndex]?.dataId;
  expect(targetId).toBeTruthy();
  await page.locator('.sceneThumb').nth(targetIndex).click();
  await page.waitForFunction(
    (id: string) =>
      document.querySelector(`.sceneThumb[data-id="${id}"]`)?.getAttribute('aria-current') ===
      'true',
    targetId as string,
    { timeout: 10_000 },
  );
  const activeCount = await page.evaluate(
    () => document.querySelectorAll('.sceneThumb[aria-current="true"]').length,
  );
  expect(activeCount).toBe(1);
});

for (const vp of VIEWPORTS) {
  test(`tour is usable at ${vp.name}`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('/p/modern-museum');
    await waitForViewer(page);

    const layout = await page.evaluate(() => ({
      panoWidth: document.querySelector('#pano')?.clientWidth ?? 0,
      panoHeight: document.querySelector('#pano')?.clientHeight ?? 0,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      scrollHeight: document.documentElement.scrollHeight,
      clientHeight: document.documentElement.clientHeight,
    }));
    // The panorama fills the viewport and the page itself never scrolls.
    expect(layout.panoWidth).toBeGreaterThan(vp.width * 0.9);
    expect(layout.panoHeight).toBeGreaterThan(vp.height * 0.5);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
    expect(layout.scrollHeight).toBeLessThanOrEqual(layout.clientHeight + 1);

    // Dragging rotates the view and must not scroll the document.
    const sceneBefore = await page.locator('.sceneName').textContent();
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.down();
    await page.mouse.move(vp.width / 2 + 120, vp.height / 2, { steps: 10 });
    await page.mouse.up();

    const after = await page.evaluate(() => ({
      scene: document.querySelector('.sceneName')?.textContent ?? '',
      scrollY: window.scrollY,
    }));
    expect(after.scene).toBe(sceneBefore);
    expect(after.scrollY).toBe(0);
  });
}
