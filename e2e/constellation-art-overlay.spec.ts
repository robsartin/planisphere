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

  // Assert the overlay *changed* the visible pixel count meaningfully in
  // either direction. Not a directional assertion (`artOn > artOff`) because
  // the two rendering modes shift the count opposite ways:
  //   * Placeholder halos are dense radial glows → many additional above-
  //     threshold pixels.
  //   * Anchor-driven illustrations (Stellarium, PR #404) are sparse line
  //     figures with alpha < 1 → they dim more stars behind them than they
  //     add fresh pixels above threshold, so the total dips.
  // Either way the layer visibly modifies the frame; the >500 floor rejects
  // both "layer failed to render at all" (delta near 0) and star-field
  // frame-to-frame jitter (typically < 100).
  expect(Math.abs(artOn - artOff)).toBeGreaterThan(500);
});
