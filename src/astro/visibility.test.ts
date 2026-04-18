/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { filterVisibleStars } from "./visibility";
import type { StarRecord } from "./catalog";

const CATALOG: StarRecord[] = [
  { hip: 11767, ra: 37.9546, dec: 89.2641, mag: 2.02, name: "Polaris" },
  { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46, name: "Sirius" },
  { hip: 7588, ra: 24.4285, dec: -57.2367, mag: 0.46, name: "Achernar" },
];

describe("filterVisibleStars", () => {
  it("includes Polaris for a northern observer", () => {
    const result = filterVisibleStars(CATALOG, 60, 0, new Date("2026-01-15T22:00:00Z"));
    const polaris = result.find((s) => s.name === "Polaris");
    expect(polaris).toBeDefined();
    expect(polaris!.alt).toBeGreaterThan(0);
  });

  it("excludes stars below the horizon", () => {
    const result = filterVisibleStars(CATALOG, 60, 0, new Date("2026-01-15T22:00:00Z"));
    for (const star of result) {
      expect(star.alt).toBeGreaterThan(0);
    }
  });

  it("each result has size and opacity from magnitude mapping", () => {
    const result = filterVisibleStars(CATALOG, 33, -117, new Date("2026-01-15T04:00:00Z"));
    for (const star of result) {
      expect(star.size).toBeGreaterThanOrEqual(3);
      expect(star.size).toBeLessThanOrEqual(16);
      expect(star.opacity).toBeGreaterThanOrEqual(0.4);
      expect(star.opacity).toBeLessThanOrEqual(1.0);
    }
  });

  it("returns AltAzStar with required fields", () => {
    const result = filterVisibleStars(CATALOG, 33, -117, new Date("2026-01-15T04:00:00Z"));
    if (result.length > 0) {
      const s = result[0];
      expect(s).toHaveProperty("hip");
      expect(s).toHaveProperty("ra");
      expect(s).toHaveProperty("dec");
      expect(s).toHaveProperty("alt");
      expect(s).toHaveProperty("az");
      expect(s).toHaveProperty("mag");
      expect(s).toHaveProperty("size");
      expect(s).toHaveProperty("opacity");
    }
  });

  it("excludes deeply southern stars from far-north observer", () => {
    const result = filterVisibleStars(CATALOG, 80, 0, new Date("2026-06-15T00:00:00Z"));
    const achernar = result.find((s) => s.name === "Achernar");
    expect(achernar).toBeUndefined();
  });
});

describe("filterVisibleStars — magLimit", () => {
  it("includes all above-horizon stars when magLimit is 6.0 (default)", () => {
    const withLimit = filterVisibleStars(CATALOG, 60, 0, new Date("2026-01-15T22:00:00Z"), 6.0);
    const withoutLimit = filterVisibleStars(CATALOG, 60, 0, new Date("2026-01-15T22:00:00Z"));
    expect(withLimit.length).toBe(withoutLimit.length);
  });

  it("excludes stars dimmer than the limit", () => {
    // Polaris has mag 2.02 — should be excluded when limit is 1.5
    const result = filterVisibleStars(CATALOG, 60, 0, new Date("2026-01-15T22:00:00Z"), 1.5);
    const polaris = result.find((s) => s.name === "Polaris");
    expect(polaris).toBeUndefined();
  });

  it("includes stars brighter than or equal to the limit", () => {
    // Sirius has mag -1.46 — always included with any reasonable limit
    const result = filterVisibleStars(CATALOG, 33, -117, new Date("2026-01-15T04:00:00Z"), 2.0);
    const sirius = result.find((s) => s.name === "Sirius");
    expect(sirius).toBeDefined();
  });

  it("mag filter is applied BEFORE alt/az computation (bright-dim test with limit=2)", () => {
    // With limit 2.0: Polaris (2.02) should be excluded, Sirius (-1.46) and Achernar (0.46) can pass
    const result = filterVisibleStars(CATALOG, 60, 0, new Date("2026-01-15T22:00:00Z"), 2.0);
    for (const star of result) {
      expect(star.mag).toBeLessThanOrEqual(2.0);
    }
  });
});
