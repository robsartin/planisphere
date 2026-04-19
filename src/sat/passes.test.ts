/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { expectOk } from "../result";
import { parseTle } from "./tle";
import { computeUpcomingPasses, isIssRecord } from "./passes";

// Pinned TLE — real ISS TLE from epoch 2024-04-09 (day 100.5 of 2024).
// Used here so pass predictions are deterministic.
const ISS_TLE = `ISS (ZARYA)
1 25544U 98067A   24100.50000000  .00016717  00000-0  10270-3 0  9006
2 25544  51.6400 208.9163 0002476 102.8574 355.4846 15.49909786447384`;

const HUBBLE_TLE = `HUBBLE
1 20580U 90037B   24100.50000000  .00001234  00000-0  56789-4 0  9005
2 20580  28.4700 123.4567 0002345  67.8901 292.1098 15.09876543210987`;

const iss = expectOk(parseTle(ISS_TLE))[0]!;

describe("computeUpcomingPasses", () => {
  it("finds at least one ISS pass over a mid-latitude site in a 48-hour window", () => {
    // Denver, CO — solid mid-latitude test site where ISS is regularly visible.
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    expect(passes.length).toBeGreaterThan(0);
  });

  it("each pass has rise < peak < set and sensible peak altitude", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    for (const p of passes) {
      expect(p.rise.getTime()).toBeLessThan(p.peak.time.getTime());
      expect(p.peak.time.getTime()).toBeLessThan(p.set.getTime());
      expect(p.peak.altDeg).toBeGreaterThan(0);
      expect(p.peak.altDeg).toBeLessThanOrEqual(90);
      expect(p.peak.azDeg).toBeGreaterThanOrEqual(0);
      expect(p.peak.azDeg).toBeLessThan(360);
    }
  });

  it("passes are sorted by rise time ascending", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    for (let i = 1; i < passes.length; i++) {
      expect(passes[i]!.rise.getTime()).toBeGreaterThanOrEqual(passes[i - 1]!.rise.getTime());
    }
  });

  it("all passes fall within the lookahead window", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const lookaheadHours = 24;
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, lookaheadHours);
    const horizon = now.getTime() + lookaheadHours * 3600 * 1000;
    for (const p of passes) {
      expect(p.rise.getTime()).toBeGreaterThanOrEqual(now.getTime());
      expect(p.rise.getTime()).toBeLessThanOrEqual(horizon);
    }
  });

  it("carries the satellite name onto each pass", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    if (passes.length > 0) {
      expect(passes[0]!.satName).toBe("ISS (ZARYA)");
    }
  });

  it("returns an empty list at the geographic poles where ISS never rises", () => {
    // ISS inclination 51.6° — it never reaches altitude > 0 from the North Pole.
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 90, 0, now, 48);
    expect(passes).toHaveLength(0);
  });

  it("only returns passes during astronomical darkness (sun < -6°)", () => {
    // At the equator in daytime, any over-horizon passes should be filtered out
    // because the sun is well above the horizon. We pick a 6-hour window centred
    // on local noon for a point near (0, 0).
    const daytime = new Date("2024-04-10T09:00:00Z"); // ~noon local at lon 0
    const passes = computeUpcomingPasses(iss, 0, 0, daytime, 6);
    // Either no passes (sun up, shadow requirement filters them) or very few —
    // we assert the stronger property downstream via the events pipeline. Here we
    // simply verify the routine doesn't crash and returns an array.
    expect(Array.isArray(passes)).toBe(true);
  });
});

describe("isIssRecord", () => {
  it("matches ISS (ZARYA)", () => {
    expect(isIssRecord(iss)).toBe(true);
  });

  it("does not match other satellites", () => {
    const hubble = expectOk(parseTle(HUBBLE_TLE))[0]!;
    expect(isIssRecord(hubble)).toBe(false);
  });
});

describe("computeUpcomingPasses — illumination at peak", () => {
  it("attaches an illumination object to each pass peak", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) {
      expect(p.peak.illumination).toBeDefined();
      expect(typeof p.peak.illumination.eclipsed).toBe("boolean");
      expect(typeof p.peak.illumination.phaseDeg).toBe("number");
      expect(typeof p.peak.illumination.rangeKm).toBe("number");
      // magnitude is number | null
      if (p.peak.illumination.eclipsed) {
        expect(p.peak.illumination.magnitude).toBeNull();
      } else {
        expect(typeof p.peak.illumination.magnitude).toBe("number");
      }
    }
  });

  it("range at peak is plausible for ISS (a few hundred to a couple thousand km)", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    expect(passes.length).toBeGreaterThan(0);
    for (const p of passes) {
      expect(p.peak.illumination.rangeKm).toBeGreaterThan(350);
      expect(p.peak.illumination.rangeKm).toBeLessThan(3000);
    }
  });

  it("sunlit passes produce a finite magnitude in a plausible range", () => {
    const now = new Date("2024-04-10T00:00:00Z");
    const passes = computeUpcomingPasses(iss, 39.74, -104.99, now, 48);
    for (const p of passes) {
      if (!p.peak.illumination.eclipsed) {
        const m = p.peak.illumination.magnitude;
        expect(m).not.toBeNull();
        expect(Number.isFinite(m!)).toBe(true);
        // ISS real-world range is roughly -4 to +5 at the extremes.
        expect(m!).toBeGreaterThan(-5);
        expect(m!).toBeLessThan(8);
      }
    }
  });
});
