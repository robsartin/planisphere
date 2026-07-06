/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it, vi } from "vitest";
import type * as SatelliteJs from "satellite.js";
import { expectOk } from "../result";
import { parseTle } from "./tle";
import { propagateSatellites } from "./propagate";
import { computeUpcomingPasses } from "./passes";

// satellite.js 7.0.1 tightens `propagate()` to return `PositionAndVelocity | null`,
// with `null` meaning "the SGP4 propagator could not resolve state at this epoch"
// (e.g. numerical instability, TLE too far past epoch). Our sat/ helpers must treat
// that as "skip this sample" — matching the existing `isValidVec3` skip path — not
// crash with `TypeError: Cannot read properties of null`.
//
// This test file mocks `propagate` to always return null; the surrounding module
// (`twoline2satrec`, `gstime`, etc.) is preserved via `importActual`.
vi.mock("satellite.js", async () => {
  const actual = await vi.importActual<typeof SatelliteJs>("satellite.js");
  return {
    ...actual,
    propagate: () => null,
  };
});

const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384`;

const iss = expectOk(parseTle(ISS_TLE))[0]!;

describe("satellite.js propagate() returning null", () => {
  it("propagateSatellites skips satellites the propagator cannot resolve", () => {
    const now = new Date("2024-04-10T03:00:00Z");
    expect(() => propagateSatellites([iss], 33, -117, now, false)).not.toThrow();
    expect(propagateSatellites([iss], 33, -117, now, false)).toHaveLength(0);
  });

  it("computeUpcomingPasses returns no passes when the propagator cannot resolve", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    expect(() => computeUpcomingPasses(iss, 39.74, -104.99, now, 6)).not.toThrow();
    expect(computeUpcomingPasses(iss, 39.74, -104.99, now, 6)).toHaveLength(0);
  });
});
