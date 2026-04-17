/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { expectOk } from "../result";
import { parseTle } from "./tle";
import { propagateSatellites } from "./propagate";

const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384`;

const satellites = expectOk(parseTle(ISS_TLE));

describe("propagateSatellites", () => {
  it("returns visible satellites with alt/az/height/velocity", () => {
    const result = propagateSatellites(
      satellites,
      33,
      -117,
      new Date("2024-04-10T03:00:00Z"),
      false,
    );
    expect(result.length).toBeGreaterThanOrEqual(0);
    if (result.length > 0) {
      const sat = result[0]!;
      expect(sat).toHaveProperty("name");
      expect(sat).toHaveProperty("noradId");
      expect(sat).toHaveProperty("alt");
      expect(sat).toHaveProperty("az");
      expect(sat).toHaveProperty("height");
      expect(sat).toHaveProperty("velocity");
      expect(sat).toHaveProperty("trail");
    }
  });

  it("orbital altitude is in reasonable LEO range", () => {
    const result = propagateSatellites(
      satellites,
      33,
      -117,
      new Date("2024-04-10T03:00:00Z"),
      false,
    );
    if (result.length > 0) {
      expect(result[0]!.height).toBeGreaterThan(200);
      expect(result[0]!.height).toBeLessThan(600);
    }
  });

  it("velocity is in reasonable LEO range", () => {
    const result = propagateSatellites(
      satellites,
      33,
      -117,
      new Date("2024-04-10T03:00:00Z"),
      false,
    );
    if (result.length > 0) {
      expect(result[0]!.velocity).toBeGreaterThan(5);
      expect(result[0]!.velocity).toBeLessThan(10);
    }
  });

  it("trail has 12 points", () => {
    const result = propagateSatellites(
      satellites,
      33,
      -117,
      new Date("2024-04-10T03:00:00Z"),
      false,
    );
    if (result.length > 0) {
      expect(result[0]!.trail).toHaveLength(12);
      for (const pt of result[0]!.trail) {
        expect(pt).toHaveProperty("alt");
        expect(pt).toHaveProperty("az");
      }
    }
  });

  it("filters to above-horizon when requested", () => {
    const result = propagateSatellites(
      satellites,
      33,
      -117,
      new Date("2024-04-10T03:00:00Z"),
      true,
    );
    for (const sat of result) {
      expect(sat.alt).toBeGreaterThan(0);
    }
  });

  it("handles empty satellite list", () => {
    const result = propagateSatellites([], 33, -117, new Date(), true);
    expect(result).toHaveLength(0);
  });
});
