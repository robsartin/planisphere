/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { magToVisual } from "./magnitude";

describe("magToVisual", () => {
  it("returns larger size for brighter stars", () => {
    const bright = magToVisual(-1.46);
    const dim = magToVisual(6.0);
    expect(bright.size).toBeGreaterThan(dim.size);
  });

  it("returns higher opacity for brighter stars", () => {
    const bright = magToVisual(0.0);
    const dim = magToVisual(6.0);
    expect(bright.opacity).toBeGreaterThan(dim.opacity);
  });

  it("clamps size to minimum for very faint stars", () => {
    const faint = magToVisual(6.5);
    expect(faint.size).toBeGreaterThanOrEqual(3);
  });

  it("clamps size to maximum for very bright stars", () => {
    const bright = magToVisual(-2.0);
    expect(bright.size).toBeLessThanOrEqual(16);
  });

  it("opacity is always between 0.4 and 1.0", () => {
    for (const mag of [-1.46, 0, 1, 2, 3, 4, 5, 6]) {
      const v = magToVisual(mag);
      expect(v.opacity).toBeGreaterThanOrEqual(0.4);
      expect(v.opacity).toBeLessThanOrEqual(1.0);
    }
  });

  it("mid-range magnitude produces intermediate values", () => {
    const mid = magToVisual(3.0);
    expect(mid.size).toBeGreaterThan(3);
    expect(mid.size).toBeLessThan(16);
    expect(mid.opacity).toBeGreaterThan(0.4);
    expect(mid.opacity).toBeLessThan(1.0);
  });
});
