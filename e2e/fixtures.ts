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
 * Wait until Cesium has actually painted at least one frame to the WebGL
 * canvas. Polls the canvas via a 2D scratch surface (drawImage + getImageData)
 * and counts non-black pixels. Used both by the dedicated Cesium-init test and
 * as a precondition for hover-pick / URL-roundtrip tests so they don't probe
 * a black canvas.
 */
export async function waitForCesiumPainted(page: Page, timeoutMs = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector<HTMLCanvasElement>("#cesium-container canvas");
      if (canvas === null || canvas.width === 0 || canvas.height === 0) return false;
      const scratch = document.createElement("canvas");
      // Sample a small central crop — Cesium clears to black, so any star
      // sprite or grid line in the centre region means painting started.
      const sampleSize = 64;
      scratch.width = sampleSize;
      scratch.height = sampleSize;
      const ctx = scratch.getContext("2d");
      if (ctx === null) return false;
      const sx = Math.max(0, Math.floor(canvas.width / 2 - sampleSize / 2));
      const sy = Math.max(0, Math.floor(canvas.height / 2 - sampleSize / 2));
      try {
        ctx.drawImage(canvas, sx, sy, sampleSize, sampleSize, 0, 0, sampleSize, sampleSize);
      } catch {
        return false;
      }
      const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] ?? 0;
        const g = data[i + 1] ?? 0;
        const b = data[i + 2] ?? 0;
        if (r + g + b > 12) nonBlack += 1;
      }
      // ≥ 4 non-black pixels in the 4096-pixel central crop means Cesium
      // has at least drawn the grid / a sprite. Conservative on purpose.
      return nonBlack >= 4;
    },
    null,
    { timeout: timeoutMs, polling: 200 },
  );
}
