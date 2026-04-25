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
  // 259-probe loop. We drive the entire sweep from a single page.evaluate
  // (see below) — running per-probe `page.mouse.move` + `page.evaluate`
  // round-trips burns ~700 ms each on Xvfb on ubuntu-latest, > 3 min total
  // and well over the default 60 s test timeout. The bumped 180 s timeout
  // here is belt-and-suspenders for slow runners; the in-page sweep runs
  // in well under a minute even on Xvfb.
  test.setTimeout(180_000);

  await seedDefaultStorage(page);
  // Anchorage at midnight — same fixture used by #302's diagnostic.
  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z");

  const canvas = page.locator("#cesium-container canvas");
  await expect(canvas).toBeVisible();
  await waitForCesiumPainted(page, 10_000);

  // Pre-warm: nudge the mouse to register a real DOM event before sweeping.
  // Without this Cesium occasionally drops the first 1-2 picks of a run.
  // The 500 ms settle is also load-bearing — Cesium has occasional async
  // texture uploads (constellation labels, Messier symbols) that finish
  // after the first painted frame; their sprites become pickable only
  // once their billboards are mounted.
  await page.mouse.move(640, 400);
  await page.waitForTimeout(500);

  // Install an in-page poller keyed by probe id. The test sets
  // `window.__hpProbeId` before each `page.mouse.move`; a 20 ms-tick poller
  // adds the current id to `__hpHitIds` whenever it sees a visible tooltip.
  // The unique-id approach gives accurate one-per-probe counts even when
  // consecutive probes both land on stars (no hidden frame between them).
  // Per-probe CDP cost is one cheap statement-set; previously the
  // querySelector + boolean read averaged ~700 ms per probe on Xvfb and
  // exhausted the test timeout.
  await page.evaluate(() => {
    const w = window as unknown as {
      __hpProbeId: number;
      __hpHitIds: Set<number>;
      __hpTimer: ReturnType<typeof setInterval> | null;
    };
    w.__hpProbeId = -1;
    w.__hpHitIds = new Set<number>();
    w.__hpTimer = setInterval(() => {
      if (w.__hpProbeId < 0) return;
      const el = document.querySelector<HTMLElement>("[data-tooltip-hover]");
      const visible =
        el !== null &&
        el.style.display === "block" &&
        el.textContent !== null &&
        el.textContent.trim() !== "";
      if (visible) w.__hpHitIds.add(w.__hpProbeId);
    }, 20);
  });

  // Keep the sweep inside the visible sky region:
  // - The 280-px side panel pins itself to top:16,right:16 (~988–1264 px).
  //   Probing under it returns null pick *and* drops some pointer events
  //   onto the panel rather than the canvas. xMax stops at 970.
  // - The bottom-HUD chip sits at y > 760; the location chip occupies the
  //   bottom-left ~150 px and the compass chip the bottom-right ~80 px.
  //   yMax stops at 700.
  // - The "Cesium ion" credit sits top-left at y < 50. yMin stops at 80.
  const cols = 37;
  const rows = 7;
  const xMin = 80;
  const xMax = 970;
  const yMin = 80;
  const yMax = 700;
  const probes = cols * rows;

  let probeId = 0;
  for (let r = 0; r < rows; r += 1) {
    const y = Math.round(yMin + ((yMax - yMin) * r) / (rows - 1));
    for (let c = 0; c < cols; c += 1) {
      const x = Math.round(xMin + ((xMax - xMin) * c) / (cols - 1));
      // The probe-id `evaluate` is a single statement so it round-trips
      // fast even on Xvfb (~5 ms vs the ~700 ms a querySelector/read takes).
      await page.evaluate((id: number) => {
        (window as unknown as { __hpProbeId: number }).__hpProbeId = id;
      }, probeId);
      probeId += 1;
      await page.mouse.move(x, y);
      // 50 ms gives Cesium 1-2 frames to update the tooltip after the move
      // and the in-page poller (20 ms tick) at least 1 sample inside the
      // probe window. Empirically gives stable hit counts across runs.
      await page.waitForTimeout(50);
    }
  }

  const hits = await page.evaluate(() => {
    const w = window as unknown as {
      __hpHitIds?: Set<number>;
      __hpTimer: ReturnType<typeof setInterval> | null;
    };
    if (w.__hpTimer !== null) clearInterval(w.__hpTimer);
    return w.__hpHitIds?.size ?? 0;
  });

  // Surface the per-run hit count so flakes leave a trail in CI logs (and so
  // future tuning of the threshold has data to reason about).
  console.warn(`[hover-pick-sweep] ${String(hits)} hits / ${String(probes)} probes`);

  // Threshold from issue #303: ≥ 25 (current main is ~36, default 3×3 is ~12).
  expect(hits).toBeGreaterThanOrEqual(25);
});
