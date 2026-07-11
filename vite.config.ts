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
  optimizeDeps: {
    exclude: ["satellite.js"],
  },
  build: {
    target: "es2022",
    sourcemap: true,
    // Cesium's ~5 MB runtime is externalized by vite-plugin-cesium (see the
    // `<script src="cesium/Cesium.js">` tag it injects), so it never enters
    // any chunk here. The manualChunks below split what's actually in the
    // main-entry graph so the first paint doesn't have to parse everything.
    //
    // Notebook is dynamically imported by app.ts (#372), so the "notebook"
    // chunk is only fetched when the user enters Notebook mode. All other
    // chunks are still statically reachable and get loaded eagerly, but
    // splitting them keeps individual chunks under the 750 KB threshold.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id): string | undefined {
          if (id.includes("@tiptap/") || id.includes("@tiptap+") || id.includes("prosemirror-"))
            return "notebook";
          if (id.includes("astronomy-engine")) return "astronomy";
          if (id.includes("satellite.js")) return "satellite";
          if (id.includes("marked") || id.includes("dompurify")) return "markdown";
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // In local dev the SPA runs on Vite (:5173) while the Worker + D1 run on
    // `wrangler dev` (:8787). Proxying `/api/*` keeps the client on a single
    // origin so cookies, fetch credentials, and the Set-Cookie redirect on
    // the magic-link callback all behave as they do in production (where the
    // merged `wrangler.jsonc` service serves both halves from one origin).
    proxy: {
      "/api": {
        target: "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
});
