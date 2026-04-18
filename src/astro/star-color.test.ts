/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { bvToRgb } from "./star-color";

describe("bvToRgb", () => {
  it("returns blue-white for B-V < -0.3 (O/B stars)", () => {
    expect(bvToRgb(-0.4)).toBe("#9bb0ff");
    expect(bvToRgb(-1.0)).toBe("#9bb0ff");
  });

  it("returns white-blue for B-V ≈ 0.0 (A stars)", () => {
    expect(bvToRgb(0.0)).toBe("#aabfff");
  });

  it("returns yellow-white for B-V ≈ 0.6 (G stars like the Sun)", () => {
    expect(bvToRgb(0.6)).toBe("#fff4ea");
  });

  it("returns orange-red for B-V > 1.4 (M stars)", () => {
    expect(bvToRgb(1.5)).toBe("#ffcc6f");
    expect(bvToRgb(2.0)).toBe("#ffcc6f");
  });

  it("interpolates between control points", () => {
    // midpoint between 0.0 (#aabfff) and 0.3 (#cad7ff) should blend
    const mid = bvToRgb(0.15);
    expect(mid).toMatch(/^#[0-9a-f]{6}$/);
    // should not be exactly either endpoint
    expect(mid).not.toBe("#aabfff");
    expect(mid).not.toBe("#cad7ff");
  });

  it("returns white for undefined B-V", () => {
    expect(bvToRgb(undefined)).toBe("#ffffff");
  });
});
