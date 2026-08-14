/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import {
  countNonBlackPixelsOnPage,
  seedDefaultStorage,
  waitForCesiumPainted,
  waitForPlanisphereReady,
} from "./fixtures";

/**
 * Constellation-art overlay smoke test (issue #366).
 *
 * The scaffolding slice (PR #401 / ADR 017) ships a placeholder sprite for
 * every constellation and a manifest-driven loader that will pick up real
 * SVG assets when they land under `data/art/western/`. This test asserts the
 * overlay actually paints something on the canvas when `?art=on` is set —
 * a differential check against the same URL with the overlay off, so it
 * survives the transition from placeholder → real art without needing an
 * absolute pixel threshold to re-tune.
 *
 * If this test fails, either the manifest broke, the loader stopped feeding
 * billboards to the scene, or `?art=on` no longer flips the state — all
 * regressions worth catching before merge.
 */
test("`?art=on` overlay adds pixels above the art-off baseline", async ({ page }) => {
  await seedDefaultStorage(page);
  // Anchorage at midnight — same fixture used by the other Cesium E2Es;
  // gives a rich set of visible constellations so the overlay has plenty
  // of centroids to paint over.
  const baseUrl = "/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z";

  await page.goto(baseUrl);
  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 5_000);
  await waitForPlanisphereReady(page);
  const artOff = await countNonBlackPixelsOnPage(page);

  await page.goto(`${baseUrl}&art=on`);
  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 5_000);
  await waitForPlanisphereReady(page);
  const artOn = await countNonBlackPixelsOnPage(page);

  // Placeholder halos are subtle radial glows (opacity ~0.12 effective) but
  // even at ~30 visible constellations they should add well over a thousand
  // pixels above the black-threshold. The margin here is a floor picked with
  // room for both the star-field varying frame-to-frame and the eventual
  // real-art slice pushing this delta into the tens of thousands.
  expect(artOn).toBeGreaterThan(artOff + 500);
});
