/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test, type Page } from "@playwright/test";
import {
  expectNoRenderErrors,
  seedDefaultStorage,
  waitForCesiumPainted,
  waitForPlanisphereReady,
} from "./fixtures";

/**
 * Constellation-art overlay smoke test (issue #366).
 *
 * Captures two screenshots against the same fixture — once with the overlay
 * off, once with `?art=on` — and asserts a meaningful number of pixels
 * differ between them. Differential rather than absolute-threshold so it
 * survives the transition from placeholder halos (#401) through anchor-
 * driven Stellarium art (#404) without needing a hand-tuned count each
 * time.
 *
 * Uses per-pixel diff (not the count-of-above-threshold difference) because
 * the two rendering modes shift pixel counts opposite ways — placeholders
 * add above-threshold pixels, anchor-driven illustrations dim some stars
 * behind them via the alpha blend AND light up others in the illustration.
 * The two effects roughly cancel in count-space even though many pixels
 * change; a per-pixel diff captures both directions correctly.
 *
 * If this test fails, either the manifest broke, the loader stopped feeding
 * geometry to the scene, or `?art=on` no longer flips the state — all
 * regressions worth catching before merge.
 *
 * The pixel diff alone is NOT sufficient, which is why this spec also calls
 * `expectNoRenderErrors`: a crashed render loop leaves the last presented
 * frame on screen, and that frozen frame differs from the art-off baseline
 * by far more than 500 pixels. The delta assertion therefore passes just as
 * happily on a dead scene as on a correctly drawn one.
 */
test("`?art=on` overlay changes the frame vs the art-off baseline", async ({ page }) => {
  await seedDefaultStorage(page);
  // Anchorage at midnight — same fixture used by the other Cesium E2Es;
  // gives a rich set of visible constellations so the overlay has plenty
  // of centroids to paint over.
  const baseUrl = "/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z";

  await page.goto(baseUrl);
  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 5_000);
  await waitForPlanisphereReady(page);
  await expectNoRenderErrors(page);
  // `networkidle` catches the tail of Vite's asset fetches so the baseline
  // frame is fully painted before the screenshot.
  await page.waitForLoadState("networkidle");
  const offPng = await page.screenshot({ type: "png", animations: "disabled" });

  await page.goto(`${baseUrl}&art=on`);
  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 5_000);
  await waitForPlanisphereReady(page);
  // Assert the render loop survived the `?art=on` frame BEFORE comparing
  // screenshots — the comparison cannot tell a crash from a success.
  await expectNoRenderErrors(page);
  // The anchor-driven overlay (#404) fetches a texture per currently-visible
  // constellation on the first `?art=on` frame: each art `Primitive` uses a
  // Cesium `Image` material, which loads its own texture from the emitted
  // asset URL and renders as untextured white until that fetch resolves. A
  // screenshot taken before the textures land therefore measures a
  // half-drawn scene. `networkidle` waits for 500 ms of quiet after the
  // image fetches finish, so the sample reflects the actual art layer.
  await page.waitForLoadState("networkidle");
  const onPng = await page.screenshot({ type: "png", animations: "disabled" });
  // The check at line 60 only catches faults present at that first frame;
  // texture upload happens later, during the `networkidle` wait above, so
  // re-check right before the screenshot to catch a crash at upload time too.
  await expectNoRenderErrors(page);

  const differing = await countDifferingPixels(page, offPng, onPng);

  // 500 is a floor picked to:
  //   * reject "layer failed to render at all" (perfect equality → 0)
  //   * absorb star-field frame-to-frame jitter (small aliasing shifts are
  //     typically < 100 changed pixels)
  //   * pass on both the placeholder-halo era (thousands of new bright
  //     pixels) and the anchor-driven era (thousands of dimmed stars +
  //     hundreds of new illustration pixels)
  //
  // It cannot reject "the render loop crashed" — a frozen last-presented
  // frame clears this floor easily. `expectNoRenderErrors` above is what
  // covers that; don't re-derive this number expecting it to.
  expect(differing).toBeGreaterThan(500);
});

/**
 * Count pixels whose RGB differs between two PNG screenshots. A per-channel
 * tolerance of 8 rejects tiny compression jitter but catches any real
 * overlay change. Both PNGs are decoded inside the page context so we can
 * use the browser's native decoder + canvas (jsdom in the runner would need
 * a heavier PNG parser dep).
 */
async function countDifferingPixels(page: Page, a: Buffer, b: Buffer): Promise<number> {
  return page.evaluate(
    async ([bytesA, bytesB]: [number[], number[]]) => {
      async function decode(bytes: number[]): Promise<Uint8ClampedArray | null> {
        const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
        const url = URL.createObjectURL(blob);
        try {
          const img = new Image();
          await new Promise<void>((resolve, reject) => {
            img.onload = () => {
              resolve();
            };
            img.onerror = () => {
              reject(new Error("image decode failed"));
            };
            img.src = url;
          });
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d");
          if (ctx === null) return null;
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, c.width, c.height).data;
        } finally {
          URL.revokeObjectURL(url);
        }
      }
      const da = await decode(bytesA);
      const db = await decode(bytesB);
      if (da === null || db === null || da.length !== db.length) return -1;
      let count = 0;
      for (let i = 0; i < da.length; i += 4) {
        const dr = Math.abs((da[i] ?? 0) - (db[i] ?? 0));
        const dg = Math.abs((da[i + 1] ?? 0) - (db[i + 1] ?? 0));
        const dbl = Math.abs((da[i + 2] ?? 0) - (db[i + 2] ?? 0));
        if (dr > 8 || dg > 8 || dbl > 8) count += 1;
      }
      return count;
    },
    [Array.from(a), Array.from(b)],
  );
}
