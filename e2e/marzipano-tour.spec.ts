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
    const appScenes = (
      window as unknown as { APP_DATA: { scenes: { id: string; name: string }[] } }
    ).APP_DATA.scenes;
    return thumbs.map((t, i) => {
      const img = t.querySelector<HTMLElement>('.sceneThumb-image');
      const bg = img ? getComputedStyle(img).backgroundImage : '';
      const badge = t.querySelector('.sceneThumb-badge')?.textContent ?? '';
      return {
        dataId: t.getAttribute('data-id'),
        ariaLabel: t.getAttribute('aria-label'),
        bgUrl: bg.replace(/^url\("?/, '').replace(/"?\)$/, ''),
        badge,
        expectedSceneId: appScenes[i]?.id ?? null,
      };
    });
  });

  // All 33 scenes present, each with its own distinct thumbnail image, and
  // every thumbnail's image genuinely comes from that same scene's own
  // tile directory -- not a placeholder or a repeated/duplicated image.
  expect(mapping).toHaveLength(33);
  expect(new Set(mapping.map((m) => m.dataId)).size).toBe(33);
  expect(new Set(mapping.map((m) => m.bgUrl)).size).toBe(33);
  mapping.forEach((m, i) => {
    // Thumbnail N (1-indexed) must map to scene N in the tour's own
    // authored order -- not just "some" unique scene.
    expect(m.dataId).toBe(m.expectedSceneId);
    expect(m.bgUrl).toContain(`/${m.dataId ?? ''}/`);
    expect(m.bgUrl).toContain('/1/f/0/0.jpg');
    expect(m.ariaLabel?.trim()).not.toBe('');
    expect(m.badge).toBe(String(i + 1).padStart(2, '0'));
  });

  // Every thumbnail image genuinely loads (not a 404 masquerading as a
  // background-image, which the DOM/CSS checks above can't catch).
  const brokenImages = await page.evaluate(async () => {
    const urls = Array.from(document.querySelectorAll<HTMLElement>('.sceneThumb-image')).map((el) =>
      getComputedStyle(el)
        .backgroundImage.replace(/^url\("?/, '')
        .replace(/"?\)$/, ''),
    );
    const results = await Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url);
        return { url, ok: res.ok };
      }),
    );
    return results.filter((r) => !r.ok).map((r) => r.url);
  });
  expect(brokenImages).toEqual([]);

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

/**
 * Compares the composited preview artwork against its own template PNG,
 * entirely inside the browser -- returning only a small verdict object,
 * never the raw pixel buffers (a full 1920x1080 RGBA array is ~8.3M
 * numbers; serializing that back across the CDP boundary via
 * page.evaluate's return value is what made an earlier version of this
 * check time out). Finds a fully-opaque pixel in the template first (the
 * five templates' border thickness/corner radius differ, so some are
 * transparent right at the literal image corner) and checks that same
 * coordinate is unchanged in the composited output -- proof the overlay
 * was actually drawn at (0,0,1920,1080), not merely selected and ignored.
 */
async function compareCompositeToTemplate(
  page: import('@playwright/test').Page,
  compositedUrl: string,
  templateUrl: string,
): Promise<{
  compositedWidth: number;
  compositedHeight: number;
  templateWidth: number;
  templateHeight: number;
  foundOpaquePixel: boolean;
  opaquePixelMatches: boolean;
}> {
  return page.evaluate(
    async ([compositedSrc, templateSrc]) => {
      function loadImage(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            resolve(img);
          };
          img.onerror = () => {
            reject(new Error('image failed to load: ' + src));
          };
          img.src = src;
        });
      }
      function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error('2d canvas context unavailable');
        }
        return ctx;
      }
      function toCanvas(img: HTMLImageElement) {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        get2dContext(canvas).drawImage(img, 0, 0);
        return canvas;
      }

      const [compositedImg, templateImg] = await Promise.all([
        loadImage(compositedSrc),
        loadImage(templateSrc),
      ]);
      const compositedCanvas = toCanvas(compositedImg);
      const templateCanvas = toCanvas(templateImg);
      const compositedCtx = get2dContext(compositedCanvas);
      const templateCtx = get2dContext(templateCanvas);

      // Pull the template's full pixel buffer ONCE and scan it entirely
      // in-page (fast typed-array iteration, not one getImageData call
      // per sample point) -- a coarse grid can legitimately miss every
      // opaque pixel for a template whose design is mostly thin line art
      // rather than solid fills. The buffer itself never leaves the page
      // (only the small verdict below does), so this stays fast even at
      // full 1920x1080 resolution.
      const templateData = templateCtx.getImageData(
        0,
        0,
        templateCanvas.width,
        templateCanvas.height,
      ).data;
      let opaqueX = -1;
      let opaqueY = -1;
      for (let i = 3; i < templateData.length; i += 4) {
        if (templateData[i] === 255) {
          const pixelIndex = i / 4;
          opaqueX = pixelIndex % templateCanvas.width;
          opaqueY = Math.floor(pixelIndex / templateCanvas.width);
          break;
        }
      }

      let opaquePixelMatches = false;
      if (opaqueX !== -1) {
        const templatePixel = templateCtx.getImageData(opaqueX, opaqueY, 1, 1).data;
        const compositedPixel = compositedCtx.getImageData(opaqueX, opaqueY, 1, 1).data;
        opaquePixelMatches =
          compositedPixel[0] === templatePixel[0] &&
          compositedPixel[1] === templatePixel[1] &&
          compositedPixel[2] === templatePixel[2] &&
          compositedPixel[3] === templatePixel[3];
      }

      return {
        compositedWidth: compositedImg.naturalWidth,
        compositedHeight: compositedImg.naturalHeight,
        templateWidth: templateImg.naturalWidth,
        templateHeight: templateImg.naturalHeight,
        foundOpaquePixel: opaqueX !== -1,
        opaquePixelMatches,
      };
    },
    [compositedUrl, templateUrl] as [string, string],
  );
}

test('capturing a screenshot always produces a 1920x1080 artwork with the selected template composited on top', async ({
  page,
}) => {
  await page.goto('/p/modern-museum');
  await waitForViewer(page);

  await page.locator('#screenshotButton').click();
  await page.locator('#screenshotPreview.is-open').waitFor({ timeout: 15_000 });

  const templateId = await page.locator('#screenshotPreview').getAttribute('data-template-id');
  if (templateId === null || !['1', '2', '3', '4', '5'].includes(templateId)) {
    throw new Error(`Expected data-template-id to be one of 1-5, got: ${String(templateId)}`);
  }

  const previewSrc = await page.locator('#screenshotPreviewImage').getAttribute('src');
  expect(previewSrc).toBeTruthy();

  const result = await compareCompositeToTemplate(
    page,
    previewSrc as string,
    `/screenshot-templates/template-${templateId}.png`,
  );

  // The exported artwork is always exactly 1920x1080, regardless of the
  // real browser viewport this test runs at -- never a raw viewport grab.
  expect(result.compositedWidth).toBe(1920);
  expect(result.compositedHeight).toBe(1080);
  expect(result.templateWidth).toBe(1920);
  expect(result.templateHeight).toBe(1080);
  expect(result.foundOpaquePixel).toBe(true);
  expect(result.opaquePixelMatches).toBe(true);
});

test('template selection is randomized across captures, not fixed to one template', async ({
  page,
}) => {
  // Each iteration does a real capture + 1920x1080 composite, which is
  // slower on CI's shared runners than locally -- the default 30s test
  // timeout was too tight for 12 iterations there. 8 draws still keeps
  // the false-failure odds negligible ((1/5)^7) while leaving headroom.
  test.setTimeout(60_000);
  await page.goto('/p/modern-museum');
  await waitForViewer(page);

  const seenTemplateIds = new Set<string>();
  for (let i = 0; i < 8; i++) {
    await page.locator('#screenshotButton').click();
    await page.locator('#screenshotPreview.is-open').waitFor({ timeout: 15_000 });
    const templateId = await page.locator('#screenshotPreview').getAttribute('data-template-id');
    if (templateId) seenTemplateIds.add(templateId);
    await page.locator('#screenshotPreviewClose').click();
    await page.locator('#screenshotPreview').waitFor({ state: 'hidden', timeout: 5_000 });
  }

  // With 5 equally-likely templates and 8 draws, the odds every single
  // draw lands on the same template are astronomically small ((1/5)^7);
  // seeing more than one distinct id is the real-world signal that
  // Math.random() -- not a fixed index -- is driving the pick.
  expect(seenTemplateIds.size).toBeGreaterThan(1);
});

test('the screenshot preview panel offers save, download, share, and close, and download produces a readable filename', async ({
  page,
}) => {
  await page.goto('/p/modern-museum');
  await waitForViewer(page);

  await page.locator('#screenshotButton').click();
  await page.locator('#screenshotPreview.is-open').waitFor({ timeout: 15_000 });

  await expect(page.locator('#screenshotPreviewSave')).toBeVisible();
  await expect(page.locator('#screenshotPreviewDownload')).toBeVisible();
  await expect(page.locator('#screenshotPreviewShare')).toBeVisible();
  await expect(page.locator('#screenshotPreviewClose')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#screenshotPreviewDownload').click(),
  ]);
  // seismic-museum-<scene>-<ISO timestamp>.png -- not a random/opaque name.
  expect(download.suggestedFilename()).toMatch(
    /^seismic-museum-[a-z0-9-]+-\d{4}-\d{2}-\d{2}t[\d-]+z\.png$/i,
  );

  await page.locator('#screenshotPreviewClose').click();
  await page.locator('#screenshotPreview').waitFor({ state: 'hidden', timeout: 5_000 });
});

test('"Share on X" opens a text-prefilled web intent that always includes the museum URL -- never claims to upload the image', async ({
  page,
}) => {
  await page.goto('/p/modern-museum');
  await waitForViewer(page);

  await page.locator('#screenshotButton').click();
  await page.locator('#screenshotPreview.is-open').waitFor({ timeout: 15_000 });

  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.locator('#screenshotPreviewShare').click(),
  ]);
  await popup.waitForLoadState('domcontentloaded').catch(() => {
    // x.com's own page may fail to fully load in a sandboxed test browser
    // (login wall, network policy) -- the URL Playwright already captured
    // is what this test actually verifies, not x.com's rendered page.
  });

  const popupUrl = new URL(popup.url());
  expect(popupUrl.hostname).toMatch(/^(twitter\.com|x\.com)$/);
  const text = popupUrl.searchParams.get('text') ?? '';
  expect(text.length).toBeGreaterThan(0);
  expect(text).toContain('/p/modern-museum');

  await popup.close();
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
