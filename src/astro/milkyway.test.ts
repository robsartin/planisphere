/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeMilkyWayPoints } from "./milkyway";

const LAT = 37.77; // San Francisco
const LON = -122.42;
const TIME = new Date("2026-04-15T03:00:00Z");

describe("computeMilkyWayPoints", () => {
  it("returns an array", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    expect(Array.isArray(points)).toBe(true);
  });

  it("returns at most the number of predefined Milky Way key points above the horizon", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    // At most as many points as we have predefined key points
    expect(points.length).toBeLessThanOrEqual(50);
  });

  it("returns at least some points above the horizon for a mid-latitude observer", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    expect(points.length).toBeGreaterThan(0);
  });

  it("all returned points are above the horizon (alt >= 0)", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    for (const pt of points) {
      expect(pt.alt).toBeGreaterThanOrEqual(0);
    }
  });

  it("all points have valid alt range [0, 90]", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    for (const pt of points) {
      expect(pt.alt).toBeGreaterThanOrEqual(0);
      expect(pt.alt).toBeLessThanOrEqual(90);
    }
  });

  it("all points have valid az range [0, 360)", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    for (const pt of points) {
      expect(pt.az).toBeGreaterThanOrEqual(0);
      expect(pt.az).toBeLessThan(360);
    }
  });

  it("all points have finite numeric alt and az", () => {
    const points = computeMilkyWayPoints(LAT, LON, TIME);
    for (const pt of points) {
      expect(typeof pt.alt).toBe("number");
      expect(typeof pt.az).toBe("number");
      expect(Number.isFinite(pt.alt)).toBe(true);
      expect(Number.isFinite(pt.az)).toBe(true);
    }
  });

  it("works for equatorial observer", () => {
    const points = computeMilkyWayPoints(0, 0, TIME);
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
  });

  it("works for polar observer", () => {
    const points = computeMilkyWayPoints(89, 0, TIME);
    expect(Array.isArray(points)).toBe(true);
  });

  it("returns different results for different times", () => {
    const points1 = computeMilkyWayPoints(LAT, LON, new Date("2026-04-15T00:00:00Z"));
    const points2 = computeMilkyWayPoints(LAT, LON, new Date("2026-04-15T12:00:00Z"));
    // At least one property should differ (Milky Way rotates with time)
    const count1 = points1.length;
    const count2 = points2.length;
    // Different times may yield different counts of visible points
    // At minimum both should be valid arrays
    expect(Array.isArray(points1)).toBe(true);
    expect(Array.isArray(points2)).toBe(true);
    // Either counts differ or some coordinate differs
    if (count1 === count2 && count1 > 0) {
      const azSum1 = points1.reduce((s, p) => s + p.az, 0);
      const azSum2 = points2.reduce((s, p) => s + p.az, 0);
      expect(Math.abs(azSum1 - azSum2)).toBeGreaterThan(0.1);
    }
  });
});
