/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { getMoonIllumination } from "./moon-phase";

describe("getMoonIllumination", () => {
  it("returns near-full illumination on a known full moon date", () => {
    // Full moon: 2026-04-02T02:12Z
    const result = getMoonIllumination(new Date("2026-04-02T02:00:00Z"));
    expect(result.fraction).toBeGreaterThan(0.95);
  });

  it("returns near-zero illumination on a known new moon date", () => {
    // New moon: 2026-04-17T11:52Z
    const result = getMoonIllumination(new Date("2026-04-17T12:00:00Z"));
    expect(result.fraction).toBeLessThan(0.05);
  });

  it("returns approximately half illumination near first quarter", () => {
    // First quarter: ~2026-04-24T02:32Z
    const result = getMoonIllumination(new Date("2026-04-24T02:00:00Z"));
    expect(result.fraction).toBeGreaterThan(0.35);
    expect(result.fraction).toBeLessThan(0.65);
  });

  it("phase angle is between 0 and 360", () => {
    const result = getMoonIllumination(new Date("2026-06-15T00:00:00Z"));
    expect(result.phaseAngle).toBeGreaterThanOrEqual(0);
    expect(result.phaseAngle).toBeLessThanOrEqual(360);
  });
});
