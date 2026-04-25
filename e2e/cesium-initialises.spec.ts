/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { countNonBlackPixelsOnPage, seedDefaultStorage, waitForCesiumPainted } from "./fixtures";

/**
 * Cesium-initialises smoke test. Boots the app at a stable URL and asserts
 * the WebGL canvas has actually painted non-black pixels within 5 s. Catches
 * the "shaders failed to compile / context lost / `Viewer` never instantiated"
 * class of regression — none of which jsdom can detect.
 *
 * Implementation note: Cesium's WebGL context is created without
 * `preserveDrawingBuffer: true`, so `canvas.toDataURL()` / `drawImage(canvas)`
 * return a black image after swap. We use `page.screenshot()` instead, which
 * captures the OS-composited viewport — the user-visible frame is the
 * ground truth this test cares about.
 */
test("cesium WebGL canvas paints non-black pixels within 5 s", async ({ page }) => {
  await seedDefaultStorage(page);
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z");

  await expect(page.locator("#cesium-container canvas")).toBeVisible();

  // The 5 s budget is from issue #303. waitForCesiumPainted polls a small
  // centre clip every 200 ms; if Cesium never paints, this throws and the
  // test fails with the timeout in the stack — clearer than a downstream
  // assertion failing on a black screenshot.
  await waitForCesiumPainted(page, 5_000);

  // Full-viewport non-black pixel count for the meaningful "non-empty"
  // assertion. Includes the side panel chrome, but the side panel alone
  // would never reach the 500-pixel floor — we'd need at least the
  // RA/Dec grid or a few stars rendered too.
  const nonBlack = await countNonBlackPixelsOnPage(page);
  expect(nonBlack).toBeGreaterThanOrEqual(500);
});
