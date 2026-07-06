/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForCesiumPainted } from "./fixtures";

/**
 * Constellation-label language regression test (#306).
 *
 * Cesium renders constellation labels into its WebGL font atlas, so a naive
 * `expect(page.locator("canvas")).toContainText("大熊座")` can't work. The
 * scene layer (`src/scene/constellations.ts`) mirrors every rendered label
 * into a hidden `<span data-label-for="constellation-<id>">…</span>` under a
 * `[data-label-mirror='constellations']` container off-screen. That gives us
 * a DOM-side handle to assert language selection without OCR / screenshot
 * diffing (both rejected per ADR 016).
 *
 * The two fixtures pick constellations whose names are unambiguously
 * different between Latin (default) and a non-Latin skyculture / language,
 * so the assertion is meaningful.
 */

test("?lang=zh renders constellation labels in Chinese (DOM mirror asserted, not the WebGL canvas)", async ({
  page,
}) => {
  await seedDefaultStorage(page);
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z&lang=zh");

  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 10_000);

  const mirror = page.locator("[data-label-mirror='constellations']");
  await expect(mirror).toBeAttached();

  // The Anchorage-at-midnight fixture has UMa (Ursa Major) reliably above
  // the horizon; its Chinese name in the shipped names/zh.json is 大熊座.
  const uma = mirror.locator("[data-label-for='constellation-UMa']");
  await expect(uma).toHaveText("大熊座", { timeout: 5_000 });

  // Sanity check: the Latin default would have been "Ursa Major"; make sure
  // that text isn't lurking in a stray span (would indicate a stale mirror).
  const latinCount = await mirror.getByText("Ursa Major").count();
  expect(latinCount).toBe(0);
});

test("?sky=chinese renders Chinese skyculture asterism labels", async ({ page }) => {
  await seedDefaultStorage(page);
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z&sky=chinese");

  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 10_000);

  // The Chinese asterism set doesn't use IAU ids, so we can't target a
  // single well-known asterism; instead assert the mirror is populated with
  // at least a few Chinese labels (non-Latin characters).
  const mirror = page.locator("[data-label-mirror='constellations']");
  await expect(mirror).toBeAttached();

  // Wait for at least one Chinese-character label to appear.
  await expect
    .poll(
      async () => {
        const texts = await mirror.locator("[data-label-for]").allTextContents();
        return texts.some((t) => /[一-鿿]/.test(t));
      },
      { timeout: 5_000 },
    )
    .toBe(true);
});
