/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForCesiumPainted } from "./fixtures";

/**
 * Hover-pick sweep regression test (issue #303, motivated by #302).
 *
 * The bug behind #302 was Cesium's default 3×3 pick rectangle being smaller
 * than the 6–10 px star sprites — most cursor positions returned null. The
 * fix widened the rect to 21×21. This sweep is the same probe the disposable
 * `scripts/diag-hover.mjs` used to validate that fix, promoted to a durable
 * Playwright test so it catches the next attempt to revert (or shrink) the
 * pick rect.
 *
 * Anchorage at midnight is the ground-truth fixture: 1280×800 viewport, 7
 * rows × 37 x-positions = 259 probes, current main yields ~36 hits. Threshold
 * of 25 is tight enough to fail on a 3×3 default (which yields ~12) and
 * loose enough to absorb star-density variance across runs.
 */
test("hover-pick sweep yields ≥ 25 hover popups across a 7×37 grid", async ({ page }) => {
  await seedDefaultStorage(page);
  // Anchorage at midnight — same fixture used by #302's diagnostic.
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z");

  const canvas = page.locator("#cesium-container canvas");
  await expect(canvas).toBeVisible();
  await waitForCesiumPainted(page, 10_000);

  // Pre-warm: nudge the mouse to register a real DOM event before sweeping.
  // Without this Cesium occasionally drops the first 1-2 picks of a run.
  await page.mouse.move(640, 400);
  await page.waitForTimeout(150);

  const cols = 37;
  const rows = 7;
  const xMin = 60;
  const xMax = 1220;
  const yMin = 120;
  const yMax = 720;

  let hits = 0;
  let probes = 0;

  for (let r = 0; r < rows; r += 1) {
    const y = Math.round(yMin + ((yMax - yMin) * r) / (rows - 1));
    for (let c = 0; c < cols; c += 1) {
      const x = Math.round(xMin + ((xMax - xMin) * c) / (cols - 1));
      probes += 1;
      await page.mouse.move(x, y);
      // Give Cesium one frame to update the tooltip element. The tooltip
      // toggles its display via inline style on hover; that's the same
      // signal the production scene uses.
      await page.waitForTimeout(40);
      const visible = await page.evaluate(() => {
        // The hover tooltip lives on document.body with `data-tooltip-hover`
        // and toggles its inline display between "block" (popup visible) and
        // "none" (no pick). See `src/scene/tooltip.ts`.
        const el = document.querySelector<HTMLElement>("[data-tooltip-hover]");
        if (el === null) return false;
        return (
          el.style.display === "block" && el.textContent !== null && el.textContent.trim() !== ""
        );
      });
      if (visible) hits += 1;
    }
  }

  // Surface the per-run hit count so flakes leave a trail in CI logs (and so
  // future tuning of the threshold has data to reason about).
  console.warn(`[hover-pick-sweep] ${String(hits)} hits / ${String(probes)} probes`);

  // Threshold from issue #303: ≥ 25 (current main is ~36, default 3×3 is ~12).
  expect(hits).toBeGreaterThanOrEqual(25);
});
