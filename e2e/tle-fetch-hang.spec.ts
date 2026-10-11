/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForPlanisphereReady } from "./fixtures";

/**
 * Bootstrap must not depend on Celestrak answering.
 *
 * `bootstrap` awaits the TLE fetch before it wires the bottom HUD and sets
 * `__PLANISPHERE_READY__`. When Celestrak accepted the connection and then
 * never replied (seen on the PR #418 CI run: four specs timed out in
 * `waitForPlanisphereReady`, with the Celestrak request still unanswered in
 * every trace), the app sat on a bare globe forever. The fetch now has a
 * deadline and falls back to the bundled snapshot; this spec holds the
 * request open to prove the planetarium still becomes ready.
 */
test("planetarium becomes ready even when the TLE host never responds", async ({ page }) => {
  await seedDefaultStorage(page);
  await page.route("https://celestrak.org/**", () => {
    // Deliberately neither fulfil, continue nor abort: the request hangs.
  });
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z");
  await waitForPlanisphereReady(page, 15_000);
  await expect(page.locator("#cesium-container canvas")).toBeVisible();
});
