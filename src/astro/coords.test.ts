/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { raDecToAltAz } from "./coords";

describe("raDecToAltAz", () => {
  it("places Polaris near zenith from the North Pole", () => {
    const polaris = { ra: 37.9546, dec: 89.2641 };
    const northPole = { lat: 89.99, lon: 0 };
    const time = new Date("2026-06-15T00:00:00Z");
    const result = raDecToAltAz(polaris.ra, polaris.dec, northPole.lat, northPole.lon, time);
    expect(result.alt).toBeGreaterThan(85);
    expect(result.alt).toBeLessThanOrEqual(90);
  });

  it("places a star at the horizon or below for wrong hemisphere", () => {
    const acrux = { ra: 186.6496, dec: -63.099 };
    const northernObs = { lat: 60, lon: 0 };
    const time = new Date("2026-06-15T00:00:00Z");
    const result = raDecToAltAz(acrux.ra, acrux.dec, northernObs.lat, northernObs.lon, time);
    expect(result.alt).toBeLessThan(0);
  });

  it("returns azimuth in 0-360 range", () => {
    const sirius = { ra: 101.2872, dec: -16.7161 };
    const obs = { lat: 33, lon: -117 };
    const time = new Date("2026-01-15T04:00:00Z");
    const result = raDecToAltAz(sirius.ra, sirius.dec, obs.lat, obs.lon, time);
    expect(result.az).toBeGreaterThanOrEqual(0);
    expect(result.az).toBeLessThan(360);
  });

  it("altitude is between -90 and +90", () => {
    const vega = { ra: 279.2347, dec: 38.7837 };
    const obs = { lat: 40, lon: -74 };
    const time = new Date("2026-08-01T02:00:00Z");
    const result = raDecToAltAz(vega.ra, vega.dec, obs.lat, obs.lon, time);
    expect(result.alt).toBeGreaterThanOrEqual(-90);
    expect(result.alt).toBeLessThanOrEqual(90);
  });
});
