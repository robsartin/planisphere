/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForCesiumPainted } from "./fixtures";

/**
 * Cesium-initialises smoke test. Boots the app at a stable URL and asserts the
 * WebGL canvas has actually painted non-black pixels within 5 s. Catches the
 * "shaders failed to compile / context lost / `Viewer` never instantiated"
 * class of regression — none of which jsdom can detect.
 *
 * Reads the canvas via a scratch 2D context (`drawImage` + `getImageData`)
 * rather than raw GL pixels — a real `gl.readPixels` call would need to be
 * stamped before Cesium's swap-buffers, which we can't synchronise from the
 * page side. The 2D snapshot reflects the most-recently-presented frame and
 * is cheap.
 */
test("cesium WebGL canvas paints non-black pixels within 5 s", async ({ page }) => {
  await seedDefaultStorage(page);
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z");

  await expect(page.locator("#cesium-container canvas")).toBeVisible();

  // The 5 s budget is from issue #303. waitForCesiumPainted polls every 200 ms
  // for a non-black sample; if Cesium never paints, this throws and the test
  // fails loudly rather than rolling silently into a downstream assertion.
  await waitForCesiumPainted(page, 5_000);

  // Sanity: now compute non-black pixels across the full canvas to give the
  // test a meaningful "non-empty" assertion vs. the bootstrap probe.
  const stats = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#cesium-container canvas");
    if (canvas === null) return { total: 0, nonBlack: 0 };
    const w = canvas.width;
    const h = canvas.height;
    const scratch = document.createElement("canvas");
    scratch.width = w;
    scratch.height = h;
    const ctx = scratch.getContext("2d");
    if (ctx === null) return { total: w * h, nonBlack: 0 };
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, w, h);
    let nonBlack = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      if (r + g + b > 12) nonBlack += 1;
    }
    return { total: w * h, nonBlack };
  });

  expect(stats.total).toBeGreaterThan(0);
  // A working render of stars + grid lines yields ≫ 1000 non-black pixels.
  // 500 is the floor that catches "WebGL never started" without false-failing
  // on minor scene changes.
  expect(stats.nonBlack).toBeGreaterThanOrEqual(500);
});
