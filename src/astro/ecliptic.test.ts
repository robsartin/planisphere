/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeEclipticLine } from "./ecliptic";

const LAT = 37.77; // San Francisco
const LON = -122.42;
const TIME = new Date("2026-04-15T03:00:00Z");

describe("computeEclipticLine", () => {
  it("returns an array of HorizontalCoord points", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    expect(Array.isArray(points)).toBe(true);
  });

  it("returns at most 180 points (one per 2° of ecliptic longitude)", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    expect(points.length).toBeLessThanOrEqual(180);
  });

  it("returns at least some points above the horizon for mid-latitude observer", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    expect(points.length).toBeGreaterThan(0);
  });

  it("all returned points are above the horizon (alt >= 0)", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    for (const pt of points) {
      expect(pt.alt).toBeGreaterThanOrEqual(0);
    }
  });

  it("all points have valid alt range [0, 90]", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    for (const pt of points) {
      expect(pt.alt).toBeGreaterThanOrEqual(0);
      expect(pt.alt).toBeLessThanOrEqual(90);
    }
  });

  it("all points have valid az range [0, 360)", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    for (const pt of points) {
      expect(pt.az).toBeGreaterThanOrEqual(0);
      expect(pt.az).toBeLessThan(360);
    }
  });

  it("all points have finite numeric alt and az", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    for (const pt of points) {
      expect(typeof pt.alt).toBe("number");
      expect(typeof pt.az).toBe("number");
      expect(Number.isFinite(pt.alt)).toBe(true);
      expect(Number.isFinite(pt.az)).toBe(true);
    }
  });

  it("ecliptic points span a reasonable azimuth range for a mid-latitude observer", () => {
    const points = computeEclipticLine(LAT, LON, TIME);
    if (points.length === 0) return; // edge case: no points visible
    const azValues = points.map((p) => p.az);
    const minAz = Math.min(...azValues);
    const maxAz = Math.max(...azValues);
    // Ecliptic should span at least 90° in az at a mid-latitude observer
    expect(maxAz - minAz).toBeGreaterThan(90);
  });

  it("works for equatorial observer", () => {
    const points = computeEclipticLine(0, 0, TIME);
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThan(0);
  });
});
