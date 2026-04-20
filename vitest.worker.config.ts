/* SPDX-License-Identifier: Apache-2.0 */
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

/**
 * Worker-only Vitest config. Runs each `worker/*.test.ts` file inside a
 * real `workerd` isolate with a bound in-memory D1 database and the
 * migrations in `migrations/` applied on startup. Completely separate from
 * `vitest.config.ts` (which runs the SPA tests under jsdom) — the two
 * runs don't share coverage numbers or config.
 */
export default defineWorkersConfig({
  test: {
    include: ["worker/**/*.test.ts"],
    poolOptions: {
      workers: {
        singleWorker: true,
        miniflare: {
          compatibilityDate: "2026-04-16",
          compatibilityFlags: ["nodejs_compat"],
          d1Databases: ["DB"],
          bindings: {
            APP_ORIGIN: "http://localhost:5173",
            SESSION_SECRET: "test-secret-at-least-32-bytes-long-please!!",
          },
        },
      },
    },
  },
});
