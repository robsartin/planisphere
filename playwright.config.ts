/* SPDX-License-Identifier: Apache-2.0 */
import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the planisphere E2E suite (issue #303, ADR 016).
 *
 * Headed Chromium only — Cesium's shaders fail to compile under SwiftShader,
 * the headless GL backend. Linux CI runs the suite under `xvfb-run -a pnpm e2e`.
 *
 * The `webServer` block boots `pnpm dev:client` (Vite only — no Worker) before
 * tests start. Tests that touch `/api/*` routes mock them with `page.route()`,
 * so the absence of `wrangler dev` is fine.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  // CI gets GitHub annotations *and* an HTML report written to
  // `playwright-report/` so the workflow's upload-artifact step has
  // something to upload (it currently warns "No files were found"
  // because neither "github" nor "list" writes a report directory).
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,

  use: {
    baseURL: "http://localhost:5173",
    headless: false,
    viewport: { width: 1280, height: 800 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev:client",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
