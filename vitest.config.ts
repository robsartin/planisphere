/* SPDX-License-Identifier: Apache-2.0 */
import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.test.ts", "worker/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts", "worker/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "worker/**/*.test.ts",
        "src/main.ts",
        "src/env.d.ts",
        "src/**/index.ts",
      ],
      thresholds: {
        // Project-wide floor
        lines: 85,
        statements: 85,
        functions: 85,
        branches: 80,

        // Pure modules — 90% lines, 85% branches
        "src/result/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
        "src/state/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
        "src/astro/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
        "src/sat/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },

        // Integration modules — 80% lines
        "src/scene/**": {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 70,
        },
        "src/ui/**": {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 70,
        },
        "src/app.ts": {
          lines: 80,
          statements: 80,
          functions: 80,
          branches: 70,
        },

        // Workers: astro-worker.ts runs inside a Web Worker context (not jsdom-testable);
        // star-builder.ts is fully tested. Set a lower floor for the whole directory.
        "src/workers/**": {
          lines: 60,
          statements: 60,
          functions: 60,
          branches: 50,
        },

        // Cloudflare Worker (backend) — pure utilities in this slice; hold to
        // the same bar as src/astro etc. Raise later if we add runtime code
        // that's impractical to test under jsdom.
        "worker/**": {
          lines: 90,
          statements: 90,
          functions: 90,
          branches: 85,
        },
      },
    },
  },
});
