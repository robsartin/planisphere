/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForCesiumPainted } from "./fixtures";

/**
 * URL-state round-trip test (issue #303 #2).
 *
 * Boots with a query string covering every interesting URL knob (lat / lon /
 * t / lang / fov) and asserts:
 *
 * 1. The SPA's URL writer didn't drop or normalise any of them — the params
 *    are still present after bootstrap (`window.location.search` is the
 *    canonical state surface, see `src/state/state.ts`).
 * 2. The FOV reticle SVG (`svg[data-reticle]`) is visible — the only
 *    user-visible signal that `?fov=binoculars` reached the scene layer.
 *
 * Language assertion stays at the URL level rather than scraping a localised
 * label. Constellation labels are rendered by Cesium into the WebGL canvas,
 * not the DOM, so a font-faithful text assertion would need OCR or screenshot
 * diffing — both out of scope per ADR 016.
 */
test("URL params survive bootstrap and the FOV reticle is rendered", async ({ page }) => {
  await seedDefaultStorage(page);
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z&lang=zh&fov=binoculars");

  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 10_000);

  const params = await page.evaluate(() => {
    const search = new URLSearchParams(window.location.search);
    return {
      lat: search.get("lat"),
      lon: search.get("lon"),
      t: search.get("t"),
      lang: search.get("lang"),
      fov: search.get("fov"),
    };
  });
  expect(params.lat).toBe("61.2");
  expect(params.lon).toBe("-149.9");
  expect(params.t).toBe("2026-04-25T08:00:00Z");
  expect(params.lang).toBe("zh");
  expect(params.fov).toBe("binoculars");

  // FOV reticle is an inline SVG inside #cesium-container. The reticle layer
  // sets display: "block" only when the preset is non-"off" — this is what
  // exercises the URL→scene pipeline end-to-end.
  const reticle = page.locator("#cesium-container svg[data-reticle]");
  await expect(reticle).toBeVisible();
  const radius = await reticle.locator("circle").getAttribute("r");
  expect(radius).not.toBeNull();
  expect(Number(radius)).toBeGreaterThan(0);
});
