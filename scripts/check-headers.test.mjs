/* SPDX-License-Identifier: Apache-2.0 */
import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";

/**
 * Guard the Cloudflare Workers `_headers` rules that give Cesium + Vite
 * chunks their long-lived immutable cache (#378). Every rule listed here
 * must survive future edits to `public/_headers`; a regression drops
 * return-visit cost by dozens of megabytes.
 */

const HEADERS = readFileSync("public/_headers", "utf8");

const REQUIRED_RULES = [
  "/assets/*",
  "/cesium/Cesium.js",
  "/cesium/Assets/*",
  "/cesium/ThirdParty/*",
  "/cesium/Widgets/*",
  "/cesium/Workers/*",
];

describe("public/_headers", () => {
  it("has the SPDX marker", () => {
    expect(HEADERS).toContain("SPDX-License-Identifier: Apache-2.0");
  });

  for (const rule of REQUIRED_RULES) {
    it(`caches ${rule} as public, max-age=31536000, immutable`, () => {
      // Find the block for this rule (the line matching `rule` verbatim
      // at the start of a line) and confirm the very next Cache-Control
      // header is the immutable one-year rule.
      const lines = HEADERS.split("\n");
      const ruleIdx = lines.findIndex((l) => l.trim() === rule);
      expect(ruleIdx, `no block for ${rule}`).toBeGreaterThan(-1);
      const cacheHeader = lines
        .slice(ruleIdx + 1)
        .find((l) => l.trim().startsWith("Cache-Control:"));
      expect(cacheHeader).toBeDefined();
      expect(cacheHeader.trim()).toBe("Cache-Control: public, max-age=31536000, immutable");
    });
  }

  it("does NOT set immutable caching on /index.html (redeploys must reach users)", () => {
    const lines = HEADERS.split("\n");
    const idx = lines.findIndex((l) => l.trim() === "/index.html");
    // Either the block doesn't exist at all, or if it does, it must not
    // set the year-long immutable cache — HTML has to be able to change
    // between deploys.
    if (idx === -1) return;
    const cacheHeader = lines.slice(idx + 1).find((l) => l.trim().startsWith("Cache-Control:"));
    if (cacheHeader === undefined) return;
    expect(cacheHeader).not.toContain("immutable");
  });
});
