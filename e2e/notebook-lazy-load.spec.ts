/* SPDX-License-Identifier: Apache-2.0 */
import { expect, test } from "@playwright/test";
import { seedDefaultStorage, waitForCesiumPainted } from "./fixtures";

/**
 * Notebook lazy-load smoke test (issue #372).
 *
 * The Notebook workspace pulls in tiptap + ProseMirror (~432 KB in its own
 * chunk). Free-tier / planetarium-mode users must never fetch it on the
 * initial page load — that's the whole reason `app.ts` does a dynamic
 * `import("./ui/notebook-workspace")` behind the Pro-gated mode toggle.
 *
 * This spec exercises the observable network behaviour:
 *
 * 1. Load the planetarium view, confirm no `notebook-*.js` request fired.
 * 2. Bail out — we don't need to also verify Pro-gated loading here; that's
 *    covered by the app.test.ts route ("set-mode intent lazily loads..."),
 *    and doing it in e2e would need a signed-in Pro session which is not
 *    the point of this spec.
 */
test("notebook chunk is not fetched on planetarium bootstrap", async ({ page }) => {
  await seedDefaultStorage(page);

  const notebookRequests: string[] = [];
  page.on("request", (req) => {
    const url = req.url();
    // Match any variant of the tiptap / notebook chunk emitted by rolldown.
    // Vite's [name]-[hash].js gives e.g. notebook-CazWQcFo.js and
    // notebook-workspace-BM_wYrHo.js. Both must be absent from a
    // planetarium-mode bootstrap.
    if (/\/assets\/notebook(-workspace)?-[^/]+\.js(\?|$)/.test(url)) {
      notebookRequests.push(url);
    }
  });

  await page.route("**/api/plans", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plans: [] }),
    });
  });
  await page.route("**/api/auth/me", async (route) => {
    await route.fulfill({ status: 401, body: "" });
  });

  await page.goto("/?lat=61.2&lon=-149.9&t=2026-04-25T08:00:00Z");
  await expect(page.locator("#cesium-container canvas")).toBeVisible();
  await waitForCesiumPainted(page, 10_000);

  // Give Vite a beat to have finished any modulepreload chain.
  await page.waitForLoadState("networkidle");

  expect(
    notebookRequests,
    `notebook chunks should not be fetched during a planetarium bootstrap, but got: ${notebookRequests.join(", ")}`,
  ).toEqual([]);
});
