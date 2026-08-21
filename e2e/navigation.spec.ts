import { expect, test } from '@playwright/test';

/**
 * Museum <-> landing page lifecycle. Entering the museum is a real browser
 * navigation (window.location.assign in SeismicStoneVideo's handleActivate,
 * and the museum's own Home button's plain <a href="/">) -- not client-side
 * routing -- so returning to `/` via the browser's Back button, or via the
 * Home button, is exactly the scenario a browser can restore from its
 * back-forward cache (bfcache): the landing page's JS heap (including
 * SeismicStoneVideo's always-running requestAnimationFrame loop) is frozen
 * and resumed as-is rather than re-mounted or re-rendered.
 *
 * Root cause (found by instrumenting a real Playwright goBack(), not
 * guessed): handleActivate sets activatingRef.current = true the moment the
 * visitor clicks to enter the museum, meaning to freeze the video only for
 * the brief exit transition -- on a fresh page load this never matters (a
 * new mount starts at that ref's initial value), but bfcache restore
 * resumes the exact same instance, so activatingRef.current stays
 * permanently true and the RAF loop's `!activatingRef.current` gate
 * permanently skips video scrubbing: exactly "frozen until a manual
 * refresh" (a real refresh is the only thing that re-initializes the ref).
 * SeismicStoneVideo now listens for `pageshow` with `event.persisted ===
 * true` (the standard bfcache-restore signal) and resets that state.
 *
 * Verifying this for real hits an environment limitation: Playwright's
 * automation-controlled Chromium does not appear to grant this navigation
 * bfcache eligibility here (confirmed by instrumenting the real
 * `pageshow` event during a goBack() in this harness -- `persisted` reads
 * `false`, i.e. Chromium did a fresh reload here, not a cache restore).
 * That's a property of automated browser control, not of the fix or of
 * real end-user browsers. So alongside a real Back-navigation check (which
 * only proves a normal reload settles correctly, not that bfcache restore
 * specifically resolves), these tests also dispatch a synthetic
 * `pageshow(persisted: true)` -- exactly the event real bfcache restore
 * fires -- to exercise the actual fix code path directly and verify it
 * does what it claims.
 */

const waitForViewer = (page: import('@playwright/test').Page) =>
  page.waitForFunction(() => document.querySelectorAll('#pano canvas').length > 0, undefined, {
    timeout: 60_000,
  });

const ENTRANCE_SETTLE_MS = 1400;

/**
 * The Marzipano export's own viewport meta uses vendor keys that some
 * engines log about (see the same constant in marzipano-tour.spec.ts) --
 * benign, part of the authored export, not something these tests own.
 */
const BENIGN_CONSOLE = /Viewport argument key .* not recognized and ignored/i;

async function heroIsResponsive(page: import('@playwright/test').Page): Promise<boolean> {
  // Sweep the pointer across the hero hit-area and check whether the
  // foreground video's currentTime actually moves in response -- the
  // real, load-bearing signal that SeismicStoneVideo's RAF loop and video
  // decoder are both genuinely alive and un-gated, not just that the DOM
  // is present.
  const before = await page.evaluate(
    () =>
      document.querySelector<HTMLVideoElement>(
        'video[class*="backgroundVideo"]:not([class*="Ring"])',
      )?.currentTime ?? -1,
  );
  const box = await page.locator('[aria-label="Enter the Seismic Museum"]').boundingBox();
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
  await page.waitForTimeout(400);
  const after = await page.evaluate(
    () =>
      document.querySelector<HTMLVideoElement>(
        'video[class*="backgroundVideo"]:not([class*="Ring"])',
      )?.currentTime ?? -1,
  );
  return after !== before;
}

/** Simulates exactly what a real browser fires on bfcache restore --
 * dispatches `pageshow` with `persisted: true` -- to exercise
 * SeismicStoneVideo's resync path directly, independent of whether this
 * particular browser-automation environment actually grants bfcache
 * eligibility for the preceding navigation. `persisted` is a read-only
 * property not settable via the Event/PageTransitionEvent constructor in
 * every engine, so it's defined directly on a plain Event instead -- all
 * the app's own listener reads is `event.persisted`. */
function dispatchSimulatedBfcacheRestore(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const evt = new Event('pageshow');
    Object.defineProperty(evt, 'persisted', { value: true });
    window.dispatchEvent(evt);
  });
}

test('a stuck mid-activation state (the real bfcache-restore failure mode) is cleared by a simulated bfcache-restore event', async ({
  page,
}) => {
  // Reproduce the exact stuck state a real bfcache restore would resume,
  // in isolation: block the actual navigation via a beforeunload confirm
  // Playwright auto-dismisses, so this stays the same component instance
  // instead of leaving the page -- clicking the hit-area still runs
  // handleActivate for real, which sets activatingRef.current = true and
  // freezes target/smoothed/displayProgress at 1 exactly as it does in
  // production, it just never gets a chance to actually navigate away.
  page.on('dialog', (dialog) => {
    dialog.dismiss().catch(() => undefined);
  });
  await page.addInitScript(() => {
    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
    });
  });
  await page.goto('/');
  await page.waitForTimeout(ENTRANCE_SETTLE_MS + 200);
  expect(await heroIsResponsive(page)).toBe(true);

  await page.locator('[aria-label="Enter the Seismic Museum"]').click();
  await page.waitForTimeout(500); // past ACTIVATE_TOTAL_MS (420ms) -- now genuinely stuck "activating", with no navigation to interrupt the check

  // Confirm it's actually stuck (proves the test reproduces the real bug,
  // not just asserting the fix in isolation).
  expect(await heroIsResponsive(page)).toBe(false);

  await dispatchSimulatedBfcacheRestore(page);
  await page.waitForTimeout(100);

  expect(await heroIsResponsive(page)).toBe(true);
});

test('browser Back from the museum to the landing page settles correctly (no permanent freeze)', async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' && !BENIGN_CONSOLE.test(m.text())) consoleErrors.push(m.text());
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Enter the Seismic Museum' })).toBeVisible();
  await page.waitForTimeout(ENTRANCE_SETTLE_MS + 200);
  expect(await heroIsResponsive(page)).toBe(true);

  await page.getByRole('button', { name: 'Enter the Seismic Museum' }).click();
  await waitForViewer(page);

  await page.goBack();
  await expect(page.getByRole('button', { name: 'Enter the Seismic Museum' })).toBeVisible();
  // Whether this particular navigation was bfcache-restored or freshly
  // reloaded, the page must settle into a responsive state within the
  // normal entrance window -- never stuck indefinitely.
  await page.waitForTimeout(ENTRANCE_SETTLE_MS + 200);

  expect(await heroIsResponsive(page)).toBe(true);
  expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('repeated museum -> home -> museum round trips never leave the landing animation frozen', async ({
  page,
}) => {
  await page.goto('/');
  await page.waitForTimeout(ENTRANCE_SETTLE_MS + 200);

  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Enter the Seismic Museum' }).click();
    await waitForViewer(page);

    await page.locator('#homeButton').click();
    await expect(page.getByRole('button', { name: 'Enter the Seismic Museum' })).toBeVisible();
    await page.waitForTimeout(ENTRANCE_SETTLE_MS + 200);
    expect(await heroIsResponsive(page)).toBe(true);
  }
});
