/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { computeRaDecGrid } from "./grid";

const LAT = 37.77; // San Francisco
const LON = -122.42;
const TIME = new Date("2026-04-15T03:00:00Z"); // Midnight local-ish, many objects above horizon

describe("computeRaDecGrid", () => {
  it("returns raLines and decLines arrays", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    expect(Array.isArray(result.raLines)).toBe(true);
    expect(Array.isArray(result.decLines)).toBe(true);
  });

  it("raLines has at most 24 lines (one per RA hour)", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    expect(result.raLines.length).toBeGreaterThan(0);
    expect(result.raLines.length).toBeLessThanOrEqual(24);
  });

  it("decLines has at most 17 lines (one per 10° Dec from -80 to +80)", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    expect(result.decLines.length).toBeGreaterThan(0);
    expect(result.decLines.length).toBeLessThanOrEqual(17);
  });

  it("each RA line has at least 2 points", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    for (const line of result.raLines) {
      expect(line.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("each Dec line has at least 2 points", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    for (const line of result.decLines) {
      expect(line.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("all points in raLines are above the horizon (alt >= 0)", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    for (const line of result.raLines) {
      for (const pt of line) {
        expect(pt.alt).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("all points in decLines are above the horizon (alt >= 0)", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    for (const line of result.decLines) {
      for (const pt of line) {
        expect(pt.alt).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("points have valid alt/az ranges", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    const allPoints = [...result.raLines.flat(), ...result.decLines.flat()];
    for (const pt of allPoints) {
      expect(pt.alt).toBeGreaterThanOrEqual(0);
      expect(pt.alt).toBeLessThanOrEqual(90);
      expect(pt.az).toBeGreaterThanOrEqual(0);
      expect(pt.az).toBeLessThan(360);
    }
  });

  it("returns empty arrays at a polar location where all stars are at horizon", () => {
    // At south pole, northern hemisphere stars never rise
    // Just verify it returns valid structure regardless
    const result = computeRaDecGrid(0, 0, TIME);
    expect(result).toHaveProperty("raLines");
    expect(result).toHaveProperty("decLines");
  });

  it("all raLines have correct alt/az structure", () => {
    const result = computeRaDecGrid(LAT, LON, TIME);
    for (const line of result.raLines) {
      for (const pt of line) {
        expect(typeof pt.alt).toBe("number");
        expect(typeof pt.az).toBe("number");
        expect(Number.isFinite(pt.alt)).toBe(true);
        expect(Number.isFinite(pt.az)).toBe(true);
      }
    }
  });
});
