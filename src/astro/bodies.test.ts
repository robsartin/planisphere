/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeBodyPositions } from "./bodies";

describe("computeBodyPositions", () => {
  it("returns 7 bodies total (some may be below horizon)", () => {
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T12:00:00Z"), false);
    expect(all).toHaveLength(7);
  });

  it("filters to above-horizon when requested", () => {
    const visible = computeBodyPositions(33, -117, new Date("2026-06-15T12:00:00Z"), true);
    for (const body of visible) {
      expect(body.alt).toBeGreaterThan(0);
    }
  });

  it("Sun is above horizon at local noon", () => {
    // Noon UTC for lon=-117 is roughly 19:00 UTC
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T19:00:00Z"), false);
    const sun = all.find((b) => b.id === "Sun");
    expect(sun).toBeDefined();
    expect(sun!.alt).toBeGreaterThan(0);
  });

  it("Sun is below horizon at local midnight", () => {
    // Midnight for lon=-117 is roughly 07:00 UTC
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T07:00:00Z"), false);
    const sun = all.find((b) => b.id === "Sun");
    expect(sun).toBeDefined();
    expect(sun!.alt).toBeLessThan(0);
  });

  it("every body has required fields", () => {
    const all = computeBodyPositions(40, -74, new Date("2026-03-15T22:00:00Z"), false);
    for (const body of all) {
      expect(body).toHaveProperty("id");
      expect(body).toHaveProperty("alt");
      expect(body).toHaveProperty("az");
      expect(body).toHaveProperty("ra");
      expect(body).toHaveProperty("dec");
      expect(body).toHaveProperty("mag");
      expect(body).toHaveProperty("size");
      expect(body).toHaveProperty("color");
    }
  });

  it("Moon has illumination and phaseAngle", () => {
    const all = computeBodyPositions(33, -117, new Date("2026-03-29T02:00:00Z"), false);
    const moon = all.find((b) => b.id === "Moon");
    expect(moon).toBeDefined();
    expect(moon!.illumination).toBeDefined();
    expect(moon!.phaseAngle).toBeDefined();
  });

  it("Sun has the largest size", () => {
    const all = computeBodyPositions(33, -117, new Date("2026-06-15T19:00:00Z"), false);
    const sun = all.find((b) => b.id === "Sun")!;
    for (const body of all) {
      expect(sun.size).toBeGreaterThanOrEqual(body.size);
    }
  });
});
