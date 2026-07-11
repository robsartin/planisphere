/* SPDX-License-Identifier: Apache-2.0 */
import type { Page } from "@playwright/test";

/**
 * Pre-seed localStorage so the SPA boots in the state every E2E test wants:
 *
 * - `planisphere.onboarding.v1=dismissed` — without this the onboarding overlay
 *   covers the canvas centre and breaks every Cesium pick.
 * - `planisphere.user.v1` set to the allowlisted Pro email so `isPro()` returns
 *   true (see `src/features.ts`). Some tests need this to exercise the Pro
 *   surfaces (deep-link plan modal, Notebook entry, etc.); harmless for the
 *   ones that don't.
 *
 * Must run via `page.addInitScript` *before* navigation so the storage is set
 * before the SPA's bootstrap reads it.
 */
export async function seedDefaultStorage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("planisphere.onboarding.v1", "dismissed");
      localStorage.setItem(
        "planisphere.user.v1",
        JSON.stringify({ email: "rob.sartin@gmail.com" }),
      );
    } catch {
      // Ignore — storage unavailable means the test that depends on this seed
      // will fail with a clearer assertion downstream.
    }
  });
}

/**
 * Wait for the SPA's bootstrap to fully complete (#373). Cesium's first paint
 * — what `waitForCesiumPainted` observes — happens very early in `bootstrap`,
 * before the bottom-HUD, tooltip, drawers, and empty-sky popover are wired
 * into the DOM. Tests that then poked those elements were racing the tail
 * of bootstrap on slow Xvfb runners, producing the intermittent
 * `bottom-hud-smoke` / `hover-pick-sweep` / `plan-modal` flake trio.
 *
 * `app.ts` sets `window.__PLANISPHERE_READY__ = true` (and dispatches a
 * `planisphere:ready` CustomEvent) as the final line of `bootstrap`.
 * `page.waitForFunction` polls the flag until it flips.
 *
 * Use this INSTEAD of / AFTER `waitForCesiumPainted` for anything that
 * asserts on DOM chrome; only paint-only tests (like `cesium-initialises`)
 * can rely on the pixel poll alone.
 */
export async function waitForPlanisphereReady(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __PLANISPHERE_READY__?: boolean }).__PLANISPHERE_READY__ === true,
    undefined,
    { timeout: timeoutMs },
  );
}

/**
 * Wait until Cesium has painted a non-black centre crop. Why screenshots
 * rather than `canvas.toDataURL()` / `drawImage(canvas)` / `gl.readPixels`?
 *
 * Cesium initialises its WebGL context without `preserveDrawingBuffer:
 * true` (see `src/scene/viewer.ts`) — that's a performance default we don't
 * want to flip just for tests. After the scene swaps buffers the back buffer
 * is undefined; reading the canvas via the 2D pipeline returns a black
 * image. A `page.screenshot()` captures the *composited* viewport at the
 * browser-process level, which reflects whatever was last presented,
 * regardless of the GL context's preservation flag.
 *
 * `polling: 200` keeps the cost ≤ 5 screenshots per second; a fully
 * painted scene typically returns within the first or second probe.
 */
export async function waitForCesiumPainted(page: Page, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  // Probe loop: take a small viewport screenshot, decode, count non-black.
  // `page.screenshot` here returns the composited frame, which reflects
  // whatever Cesium presented even without `preserveDrawingBuffer`.
  while (Date.now() - start < timeoutMs) {
    const png = await page.screenshot({
      clip: { x: 600, y: 360, width: 80, height: 80 },
      type: "png",
      animations: "disabled",
    });
    const nonBlack = await page.evaluate(async (bytes: number[]) => {
      const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      try {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            resolve();
          };
          img.onerror = () => {
            reject(new Error("image decode failed"));
          };
          img.src = url;
        });
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        if (ctx === null) return 0;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, c.width, c.height).data;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i] ?? 0;
          const g = data[i + 1] ?? 0;
          const b = data[i + 2] ?? 0;
          if (r + g + b > 12) count += 1;
        }
        return count;
      } finally {
        URL.revokeObjectURL(url);
      }
    }, Array.from(png));
    if (nonBlack >= 4) return;
    await page.waitForTimeout(200);
  }
  throw new Error(
    `Cesium canvas did not paint within ${String(timeoutMs)}ms (no non-black pixels in 80×80 centre crop)`,
  );
}

/**
 * Count non-black pixels across a full-viewport screenshot. The Cesium-
 * init test uses this for its "≥ 500 non-black pixels" assertion. Same
 * decode-via-page trick as `waitForCesiumPainted`.
 */
export async function countNonBlackPixelsOnPage(page: Page): Promise<number> {
  const png = await page.screenshot({
    fullPage: false,
    type: "png",
    animations: "disabled",
  });
  return page.evaluate(async (bytes: number[]) => {
    const blob = new Blob([new Uint8Array(bytes)], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          resolve();
        };
        img.onerror = () => {
          reject(new Error("image decode failed"));
        };
        img.src = url;
      });
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      if (ctx === null) return 0;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        if (r + g + b > 12) count += 1;
      }
      return count;
    } finally {
      URL.revokeObjectURL(url);
    }
  }, Array.from(png));
}
