/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { gmstFromMs, lstFromMs, altAzFromRaDec } from "./worker-math";

describe("gmstFromMs", () => {
  it("returns a value in [0, 360)", () => {
    const result = gmstFromMs(new Date("2026-04-15T00:00:00Z").getTime());
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(360);
  });

  it("increases by ~360.985° per sidereal day", () => {
    const t1 = new Date("2026-04-15T00:00:00Z").getTime();
    // One sidereal day = 86164.0905 seconds
    const t2 = t1 + 86164090.5;
    const g1 = gmstFromMs(t1);
    const g2 = gmstFromMs(t2);
    // After one sidereal day GMST should return to nearly the same value (mod 360)
    let diff = (g2 - g1 + 360) % 360;
    if (diff > 180) diff = 360 - diff; // take the shorter arc
    expect(diff).toBeLessThan(0.01); // within 0.01°
  });

  it("returns finite values for extreme dates", () => {
    expect(Number.isFinite(gmstFromMs(0))).toBe(true);
    expect(Number.isFinite(gmstFromMs(Date.now()))).toBe(true);
  });
});

describe("lstFromMs", () => {
  it("adds longitude offset to GMST", () => {
    const timeMs = new Date("2026-04-15T12:00:00Z").getTime();
    const gmst = gmstFromMs(timeMs);
    const lst0 = lstFromMs(timeMs, 0);
    const lst90 = lstFromMs(timeMs, 90);
    expect(lst0).toBeCloseTo(gmst, 5);
    // LST at lon=90 should be ~90° ahead of LST at lon=0
    let diff = lst90 - lst0;
    if (diff < 0) diff += 360;
    expect(diff).toBeCloseTo(90, 4);
  });

  it("returns values in [0, 360)", () => {
    const timeMs = new Date("2026-01-01T00:00:00Z").getTime();
    for (const lon of [-180, -90, 0, 90, 180]) {
      const result = lstFromMs(timeMs, lon);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(360);
    }
  });
});

describe("altAzFromRaDec", () => {
  const PI = Math.PI;

  it("returns altitude near 90° for star at zenith", () => {
    // A star at the observer's meridian and dec = lat will be near the zenith
    const lat = 45; // 45°N
    const latRad = (lat * PI) / 180;
    const localST = 100; // LST = 100°
    const ra = 100; // HA = 0 (star on meridian)
    const dec = lat; // dec = lat → near zenith
    const { alt } = altAzFromRaDec(ra, dec, latRad, localST);
    expect(alt).toBeGreaterThan(80);
  });

  it("returns negative altitude for a star well below the horizon", () => {
    // A star with dec much less than -(90 - lat) can never rise above the horizon
    const lat = 45;
    const latRad = (lat * PI) / 180;
    const localST = 100;
    const ra = 100; // on meridian
    // dec = -(90 - lat) - 10 is circumpolar below the horizon (never rises)
    const dec = -(90 - lat) - 10;
    const { alt } = altAzFromRaDec(ra, dec, latRad, localST);
    expect(alt).toBeLessThan(0);
  });

  it("returns azimuth in [0, 360)", () => {
    const latRad = (40 * PI) / 180;
    for (const ra of [0, 90, 180, 270]) {
      const { az } = altAzFromRaDec(ra, 0, latRad, 0);
      expect(az).toBeGreaterThanOrEqual(0);
      expect(az).toBeLessThan(360);
    }
  });

  it("returns finite numbers for all outputs", () => {
    const latRad = (45 * PI) / 180;
    const { alt, az } = altAzFromRaDec(180, 0, latRad, 0);
    expect(Number.isFinite(alt)).toBe(true);
    expect(Number.isFinite(az)).toBe(true);
  });

  it("handles polar latitudes without NaN", () => {
    // North pole — all stars circumpolar
    const latRad = (89.99 * PI) / 180;
    const { alt, az } = altAzFromRaDec(37.9546, 89.2641, latRad, 37.9546);
    expect(Number.isFinite(alt)).toBe(true);
    expect(Number.isFinite(az)).toBe(true);
    expect(alt).toBeGreaterThan(80);
  });

  it("handles altitude near horizon (cosAlt ≈ 0) without NaN", () => {
    // Force alt ≈ 0 by setting dec ≈ -lat and HA near 90°
    const lat = 30;
    const latRad = (lat * PI) / 180;
    const ra = 0;
    const localST = 90; // HA = 90°
    const dec = 0; // roughly on horizon at equator
    const { alt, az } = altAzFromRaDec(ra, dec, latRad, localST);
    expect(Number.isFinite(alt)).toBe(true);
    expect(Number.isFinite(az)).toBe(true);
  });
});
