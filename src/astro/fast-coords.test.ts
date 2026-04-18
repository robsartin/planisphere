/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { fastRaDecToAltAz } from "./fast-coords";
import { raDecToAltAz } from "./coords";

/** Max allowed difference in degrees between fast and precise transforms */
const TOLERANCE_DEG = 1.0;

describe("fastRaDecToAltAz", () => {
  it("places Polaris near zenith from the North Pole", () => {
    const polaris = { ra: 37.9546, dec: 89.2641 };
    const northPole = { lat: 89.99, lon: 0 };
    const time = new Date("2026-06-15T00:00:00Z");
    const result = fastRaDecToAltAz(polaris.ra, polaris.dec, northPole.lat, northPole.lon, time);
    expect(result.alt).toBeGreaterThan(85);
    expect(result.alt).toBeLessThanOrEqual(90);
  });

  it("places a star at or below the horizon for wrong hemisphere", () => {
    const acrux = { ra: 186.6496, dec: -63.099 };
    const northernObs = { lat: 60, lon: 0 };
    const time = new Date("2026-06-15T00:00:00Z");
    const result = fastRaDecToAltAz(acrux.ra, acrux.dec, northernObs.lat, northernObs.lon, time);
    expect(result.alt).toBeLessThan(5); // below or near horizon
  });

  it("returns azimuth in [0, 360) range", () => {
    const sirius = { ra: 101.2872, dec: -16.7161 };
    const obs = { lat: 33, lon: -117 };
    const time = new Date("2026-01-15T04:00:00Z");
    const result = fastRaDecToAltAz(sirius.ra, sirius.dec, obs.lat, obs.lon, time);
    expect(result.az).toBeGreaterThanOrEqual(0);
    expect(result.az).toBeLessThan(360);
  });

  it("altitude is between -90 and +90", () => {
    const vega = { ra: 279.2347, dec: 38.7837 };
    const obs = { lat: 40, lon: -74 };
    const time = new Date("2026-08-01T02:00:00Z");
    const result = fastRaDecToAltAz(vega.ra, vega.dec, obs.lat, obs.lon, time);
    expect(result.alt).toBeGreaterThanOrEqual(-90);
    expect(result.alt).toBeLessThanOrEqual(90);
  });

  it("produces finite numbers for all outputs", () => {
    const result = fastRaDecToAltAz(180, 0, 45, -90, new Date("2026-03-20T12:00:00Z"));
    expect(Number.isFinite(result.alt)).toBe(true);
    expect(Number.isFinite(result.az)).toBe(true);
  });

  // Accuracy tests: fast transform should be within TOLERANCE_DEG of Astronomy Engine
  describe("accuracy vs raDecToAltAz (Astronomy Engine)", () => {
    function assertCloseEnough(
      ra: number,
      dec: number,
      lat: number,
      lon: number,
      time: Date,
    ): void {
      const precise = raDecToAltAz(ra, dec, lat, lon, time);
      const fast = fastRaDecToAltAz(ra, dec, lat, lon, time);

      const altDiff = Math.abs(fast.alt - precise.alt);
      expect(altDiff).toBeLessThan(TOLERANCE_DEG);

      // Azimuth comparison only meaningful when star is well above horizon
      if (precise.alt > 5) {
        // Near poles az wraps erratically; skip az check near zenith
        if (precise.alt < 80) {
          let azDiff = Math.abs(fast.az - precise.az);
          if (azDiff > 180) azDiff = 360 - azDiff; // wrap-around distance
          expect(azDiff).toBeLessThan(TOLERANCE_DEG);
        }
      }
    }

    it("matches for Sirius from Los Angeles", () => {
      assertCloseEnough(101.2872, -16.7161, 33, -117, new Date("2026-01-15T04:00:00Z"));
    });

    it("matches for Vega from New York", () => {
      assertCloseEnough(279.2347, 38.7837, 40, -74, new Date("2026-08-01T02:00:00Z"));
    });

    it("matches for Betelgeuse from London", () => {
      assertCloseEnough(88.7929, 7.4071, 51.5, -0.1, new Date("2026-02-01T20:00:00Z"));
    });

    it("matches for Canopus from Sydney", () => {
      assertCloseEnough(95.9879, -52.6956, -33.9, 151.2, new Date("2026-03-15T22:00:00Z"));
    });

    it("matches for Arcturus from Tokyo", () => {
      assertCloseEnough(213.9153, 19.1822, 35.7, 139.7, new Date("2026-05-15T18:00:00Z"));
    });

    it("matches for Spica from equatorial observer", () => {
      assertCloseEnough(201.2983, -11.1614, 0, 0, new Date("2026-04-15T00:00:00Z"));
    });

    it("matches for Rigel from southern hemisphere", () => {
      assertCloseEnough(78.6345, -8.2016, -34, 18.5, new Date("2026-07-01T03:00:00Z"));
    });

    it("matches for Aldebaran from mid-latitude", () => {
      assertCloseEnough(68.9802, 16.5093, 45, -75, new Date("2026-11-15T23:00:00Z"));
    });
  });
});
