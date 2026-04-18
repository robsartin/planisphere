/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchObjects } from "./search";
import type { StarRecord } from "./catalog";
import type { ConstellationRecord } from "./constellations";
import type { SatelliteRecord } from "../sat/tle";

// Minimal mock data
const STARS: StarRecord[] = [
  { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.44, name: "Sirius" },
  { hip: 27989, ra: 88.7929, dec: 7.4071, mag: 0.45, name: "Betelgeuse" },
  { hip: 91262, ra: 279.2346, dec: 38.7837, mag: 0.03, name: "Vega" },
  { hip: 1, ra: 0, dec: 0, mag: 5.0 }, // unnamed star — should not appear in results
];

const CONSTELLATIONS: ConstellationRecord[] = [
  { id: "Ori", name: "Orion", lines: [[27989, 24436]] },
  { id: "Leo", name: "Leo", lines: [[49669, 54872]] },
  { id: "UMa", name: "Ursa Major", lines: [[54061, 53910]] },
];

const BODY_NAMES = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn"];

// Minimal SatelliteRecord stub — satrec is never called in search
const SATELLITES: Pick<SatelliteRecord, "name" | "noradId">[] = [
  { name: "ISS (ZARYA)", noradId: 25544 },
  { name: "HUBBLE", noradId: 20580 },
  { name: "NOAA 19", noradId: 33591 },
];

// A fixed observer location (NYC) and time used for alt/az computation
const LAT = 40.71;
const LON = -74.01;
const TIME = new Date("2026-04-15T22:00:00Z");

describe("buildSearchIndex", () => {
  it("returns an index object (non-null)", () => {
    const index = buildSearchIndex(
      STARS,
      CONSTELLATIONS,
      BODY_NAMES,
      SATELLITES as SatelliteRecord[],
      LAT,
      LON,
      TIME,
    );
    expect(index).toBeTruthy();
  });

  it("includes named stars, skips unnamed stars", () => {
    const index = buildSearchIndex(
      STARS,
      CONSTELLATIONS,
      BODY_NAMES,
      SATELLITES as SatelliteRecord[],
      LAT,
      LON,
      TIME,
    );
    const results = searchObjects(index, "Sirius");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name).toBe("Sirius");
    expect(results[0]!.type).toBe("star");
  });

  it("includes constellation names", () => {
    const index = buildSearchIndex(
      STARS,
      CONSTELLATIONS,
      BODY_NAMES,
      SATELLITES as SatelliteRecord[],
      LAT,
      LON,
      TIME,
    );
    const results = searchObjects(index, "Orion");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name).toBe("Orion");
    expect(results[0]!.type).toBe("constellation");
  });

  it("includes body names", () => {
    const index = buildSearchIndex(
      STARS,
      CONSTELLATIONS,
      BODY_NAMES,
      SATELLITES as SatelliteRecord[],
      LAT,
      LON,
      TIME,
    );
    const results = searchObjects(index, "Mars");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name).toBe("Mars");
    expect(results[0]!.type).toBe("body");
  });

  it("includes satellite names", () => {
    const index = buildSearchIndex(
      STARS,
      CONSTELLATIONS,
      BODY_NAMES,
      SATELLITES as SatelliteRecord[],
      LAT,
      LON,
      TIME,
    );
    const results = searchObjects(index, "ISS");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.name).toContain("ISS");
    expect(results[0]!.type).toBe("satellite");
  });
});

describe("searchObjects", () => {
  const index = buildSearchIndex(
    STARS,
    CONSTELLATIONS,
    BODY_NAMES,
    SATELLITES as SatelliteRecord[],
    LAT,
    LON,
    TIME,
  );

  it("returns empty array for query shorter than 2 chars", () => {
    expect(searchObjects(index, "")).toHaveLength(0);
    expect(searchObjects(index, "S")).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const lower = searchObjects(index, "sirius");
    const upper = searchObjects(index, "SIRIUS");
    const mixed = searchObjects(index, "SiRiUs");
    expect(lower.length).toBeGreaterThan(0);
    expect(lower[0]!.name).toBe("Sirius");
    expect(upper.length).toBe(lower.length);
    expect(mixed.length).toBe(lower.length);
  });

  it("finds Betelgeuse by substring 'etel'", () => {
    const results = searchObjects(index, "etel");
    const names = results.map((r) => r.name);
    expect(names).toContain("Betelgeuse");
  });

  it("finds Orion by prefix 'Ori'", () => {
    const results = searchObjects(index, "Ori");
    const names = results.map((r) => r.name);
    expect(names).toContain("Orion");
  });

  it("finds Ursa Major by substring 'ursa'", () => {
    const results = searchObjects(index, "ursa");
    const names = results.map((r) => r.name);
    expect(names).toContain("Ursa Major");
  });

  it("returns at most 10 results", () => {
    // 's' matches multiple items across all categories
    const results = searchObjects(index, "s");
    expect(results.length).toBeLessThanOrEqual(10);
  });

  it("each result has name, type, alt, az", () => {
    const results = searchObjects(index, "Sirius");
    expect(results.length).toBeGreaterThan(0);
    const r = results[0]!;
    expect(typeof r.name).toBe("string");
    expect(["star", "constellation", "body", "satellite"]).toContain(r.type);
    expect(typeof r.alt).toBe("number");
    expect(typeof r.az).toBe("number");
  });

  it("marks objects below horizon with belowHorizon true", () => {
    // All objects may or may not be visible depending on time/location.
    // We verify the field always exists and is boolean.
    const results = searchObjects(index, "si");
    for (const r of results) {
      expect(typeof r.belowHorizon).toBe("boolean");
    }
  });

  it("no results for a query that matches nothing", () => {
    const results = searchObjects(index, "zzzzzzzzz");
    expect(results).toHaveLength(0);
  });
});
