/* SPDX-License-Identifier: Apache-2.0 */
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import cesium from "vite-plugin-cesium";
import type { Plugin } from "vite";

// satellite.js v7 ships pthreads WASM build which uses top-level await and
// Node-specific imports. We only use the pure-JS SGP4 API (twoline2satrec,
// propagate, transforms) so we stub out the problematic WASM pthreads module.
function stubSatelliteJsWasm(): Plugin {
  const PTHREADS_PATH =
    "node_modules/.pnpm/satellite.js@7.0.0/node_modules/satellite.js/wasm-build/pthreads-release/index.js";
  const STUB_ID = "\0satellite-wasm-pthreads-stub";
  return {
    name: "stub-satellite-js-wasm",
    enforce: "pre",
    resolveId(id) {
      // Intercept by exact wasm-build path or package-internal alias
      if (id.includes("pthreads-release") || id === "#wasm-multi-thread") {
        return STUB_ID;
      }
    },
    load(id) {
      if (id === STUB_ID || id.includes(PTHREADS_PATH)) {
        return `export default function Module() { return Promise.resolve({}); }`;
      }
    },
  };
}

export default defineConfig({
  plugins: [cesium(), stubSatelliteJsWasm()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    target: "es2022",
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
