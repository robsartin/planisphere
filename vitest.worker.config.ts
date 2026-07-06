/* SPDX-License-Identifier: Apache-2.0 */
import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

/**
 * Worker-only Vitest config. Runs each `worker/*.test.ts` file inside a
 * real `workerd` isolate with a bound in-memory D1 database and the
 * migrations in `migrations/` applied on startup. Completely separate from
 * `vitest.config.ts` (which runs the SPA tests under jsdom) — the two
 * runs don't share coverage numbers or config.
 *
 * `@cloudflare/vitest-pool-workers` 0.18 replaced the old
 * `defineWorkersConfig({ test: { poolOptions: { workers } } })` entry point
 * with a Vite plugin (`cloudflareTest`) that carries the same options —
 * see the package's `codemods/vitest-v3-to-v4` for the mechanical shape.
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      singleWorker: true,
      miniflare: {
        compatibilityDate: "2026-04-16",
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: ["DB"],
        bindings: {
          SESSION_SECRET: "test-secret-at-least-32-bytes-long-please!!",
        },
      },
    }),
  ],
  test: {
    include: ["worker/**/*.test.ts"],
  },
});
