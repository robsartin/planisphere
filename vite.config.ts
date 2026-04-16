/* SPDX-License-Identifier: Apache-2.0 */
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import cesium from "vite-plugin-cesium";

export default defineConfig({
  plugins: [cesium()],
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
