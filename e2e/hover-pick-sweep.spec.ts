/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForCesiumPainted, waitForPlanisphereReady } from "./fixtures";

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
  // Tooltip element and pick handler are wired mid-bootstrap; `waitForCesiumPainted`
  // returns as soon as the first star field paints, which can happen before those
  // are attached on slow Xvfb runners. Wait for the bootstrap-complete flag so
  // the sweep doesn't start with 0 hits (#373).
  await waitForPlanisphereReady(page);

  // Pre-warm: nudge the mouse to register a real DOM event before sweeping.
  // Without this Cesium occasionally drops the first 1-2 picks of a run.
  // The 500 ms settle is also load-bearing — Cesium has occasional async
  // texture uploads (constellation labels, Messier symbols) that finish
  // after the first painted frame; their sprites become pickable only
  // once their billboards are mounted.
  await page.mouse.move(640, 400);
  await page.waitForTimeout(500);

  // Install an in-page sampler that hooks the canvas's native `mousemove`
  // events. Cesium's hover handler runs synchronously on `mousemove`, then
  // its render loop updates the tooltip's inline display next animation
  // frame. We therefore key hits by `(probeKey)` — derived from the
  // mouse coords — and check the tooltip state ~30 ms after each move via
  // a microtask scheduled inside the listener. No per-probe CDP roundtrip
  // is needed beyond the `page.mouse.move` itself.
  //
  // Why this design? The previous "per-probe `page.evaluate` to set a
  // probeId" approach round-tripped ~700 ms per probe on Xvfb on
  // ubuntu-latest CI (vs. ~5 ms on macOS), pushing the 259-probe loop
  // past the 180 s test timeout. By piggybacking on the mousemove event
  // that the `page.mouse.move` already triggers, we get the probe-id
  // for free and only pay for the move + sleep — no second roundtrip.
  await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#cesium-container canvas");
    if (canvas === null) return;
    const w = window as unknown as {
      __hpHitKeys: Set<string>;
      __hpKindCounts: Record<string, number>;
    };
    w.__hpHitKeys = new Set<string>();
    // Per-pick "kind" tally so we can assert that the sweep doesn't go all
    // stars — constellation-line picks (regression case from #305) need to
    // show up too. Star popups end with "RA …", constellation popups with
    // "(constellation)"; we key on those textContent suffixes.
    w.__hpKindCounts = { star: 0, constellation: 0, other: 0 };
    canvas.addEventListener("mousemove", (e: MouseEvent) => {
      // Snapshot coords now; check tooltip after Cesium's frame updates.
      const key = `${String(Math.round(e.clientX))},${String(Math.round(e.clientY))}`;
      // Three rAF gives Cesium 2 frames to react and 1 frame for the
      // tooltip's inline-style write to land. Empirically stable on
      // both macOS and Xvfb.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const t = document.querySelector<HTMLElement>("[data-tooltip-hover]");
            if (
              t !== null &&
              t.style.display === "block" &&
              t.textContent !== null &&
              t.textContent.trim() !== ""
            ) {
              w.__hpHitKeys.add(key);
              const txt = t.textContent;
              if (txt.includes("(constellation)")) {
                w.__hpKindCounts.constellation += 1;
              } else if (/RA \d+h/.test(txt)) {
                // Stars / planets / Messier all show RA — distinguishing
                // them further isn't useful for this regression assertion.
                w.__hpKindCounts.star += 1;
              } else {
                w.__hpKindCounts.other += 1;
              }
            }
          });
        });
      });
    });
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

  for (let r = 0; r < rows; r += 1) {
    const y = Math.round(yMin + ((yMax - yMin) * r) / (rows - 1));
    for (let c = 0; c < cols; c += 1) {
      const x = Math.round(xMin + ((xMax - xMin) * c) / (cols - 1));
      await page.mouse.move(x, y);
      // Frame budget for Cesium's pick + tooltip update + the listener's
      // 3-rAF deferred sample. ~50 ms is 3 frames at 60 fps with headroom.
      await page.waitForTimeout(50);
    }
  }

  // One final settle to make sure the listener for the last probe ran.
  await page.waitForTimeout(100);

  const sample = await page.evaluate(() => {
    const w = window as unknown as {
      __hpHitKeys?: Set<string>;
      __hpKindCounts?: Record<string, number>;
    };
    return {
      hits: w.__hpHitKeys?.size ?? 0,
      kinds: w.__hpKindCounts ?? { star: 0, constellation: 0, other: 0 },
    };
  });

  // Surface the per-run hit count so flakes leave a trail in CI logs (and so
  // future tuning of the threshold has data to reason about).
  console.warn(
    `[hover-pick-sweep] ${String(sample.hits)} hits / ${String(probes)} probes ` +
      `(stars=${String(sample.kinds.star)}, ` +
      `constellations=${String(sample.kinds.constellation)}, ` +
      `other=${String(sample.kinds.other)})`,
  );

  // Threshold from issue #303: ≥ 25 (current main is ~36, default 3×3 is ~12).
  expect(sample.hits).toBeGreaterThanOrEqual(25);

  // Regression test for #305: constellation polylines must carry an `id` so
  // hovering a stick-figure line opens its constellation popup. With #305
  // landed, the 7×37 grid over Anchorage at midnight reliably picks up at
  // least 1 constellation line (Ursa Major's stick figure is dead centre).
  // Without #305, this drops to 0 — labels alone are too small to land in
  // the sweep.
  expect(sample.kinds.constellation).toBeGreaterThanOrEqual(1);
});
