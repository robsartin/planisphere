/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage } from "./fixtures";

/**
 * Deep-link plan modal test (issue #303 #3).
 *
 * Boots the SPA with `?plan=2026-04` and asserts the reader modal opens with
 * the seeded plan content. The plan reader is Pro-gated server-side
 * (ADR 015), so the test:
 *
 * - Pre-seeds `planisphere.user.v1` with the allowlisted Pro email via
 *   `seedDefaultStorage` (matches the Rung-1 client gate in `src/features.ts`).
 * - Intercepts `/api/plans/2026-04` with `page.route()` so the test doesn't
 *   need a live `wrangler dev` worker. The fixture payload mirrors the shape
 *   the worker's JSON column would return — `bodyMd` is rendered through
 *   `marked` + `dompurify` by `src/ui/plans-modal.ts`.
 *
 * Fixture chosen as `2026-04` because that's the slug shipped under
 * `data/plans/2026-04.md`; using a real production slug means the test
 * doubles as a guard against the slug being silently renamed.
 */
const PLAN_FIXTURE = {
  slug: "2026-04",
  title: "April 2026 — E2E plan fixture",
  month: "2026-04",
  hemisphere: "both" as const,
  summary: "E2E fixture summary line.",
  author: "Test Suite",
  publishedAt: "2026-04-01T00:00:00Z",
  bodyMd: "## Body heading\n\nFixture body paragraph.",
  objects: [{ kind: "messier" as const, id: "31", label: "Andromeda Galaxy (M31)" }],
};

test("deep-link ?plan=<slug> opens the plan reader modal with the plan title", async ({ page }) => {
  await seedDefaultStorage(page);

  // Stub the Pro-gated `/api/plans/:slug` endpoint. The Worker is not running
  // in the e2e webServer (just Vite), so this is the only way the modal can
  // populate without a backend roundtrip.
  await page.route("**/api/plans/2026-04", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PLAN_FIXTURE),
    });
  });
  // Other /api/* calls (auth/me, plans list refresh) — return safe 401s so
  // the SPA falls back to its existing client-state without spamming network
  // errors during the test.
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 401, body: "" });
  });
  await page.route("**/api/plans", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plans: [] }),
    });
  });

  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z&plan=2026-04");
  // Don't wait for the canvas to paint here — the modal renders on top of
  // a `rgba(0,0,0,0.55)` backdrop, which would dim any non-black sample
  // taken from the centre crop. The test cares about the modal itself, and
  // its `setPlan` is fired by `openPlanBySlug` immediately after bootstrap
  // (URL hydration → set-active-plan intent → `getPlan` → `plansModal.setPlan`).
  await expect(page.locator("#cesium-container canvas")).toBeVisible();

  // The modal renders into a fixed `data-plans-modal-card` container. Title
  // text is set by `setPlan(plan)` in `src/ui/plans-modal.ts`.
  const card = page.locator("[data-plans-modal-card]");
  await expect(card).toBeVisible({ timeout: 10_000 });
  await expect(card).toContainText("April 2026 — E2E plan fixture");
  await expect(card).toContainText("Body heading");
  await expect(card).toContainText("Andromeda Galaxy (M31)");
});
