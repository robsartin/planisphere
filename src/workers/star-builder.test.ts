/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { buildRaDecArray, buildAltAzStars } from "./star-builder";
import type { StarRecord } from "../astro";

const CATALOG: StarRecord[] = [
  { hip: 11767, ra: 37.9546, dec: 89.2641, mag: 2.02, name: "Polaris" },
  { hip: 32349, ra: 101.2872, dec: -16.7161, mag: -1.46, name: "Sirius" },
  { hip: 7588, ra: 24.4285, dec: -57.2367, mag: 0.46, name: "Achernar" },
];

describe("buildRaDecArray", () => {
  it("returns a Float64Array with length = catalog.length * 2", () => {
    const arr = buildRaDecArray(CATALOG);
    expect(arr).toBeInstanceOf(Float64Array);
    expect(arr.length).toBe(CATALOG.length * 2);
  });

  it("interleaves ra at even indices and dec at odd indices", () => {
    const arr = buildRaDecArray(CATALOG);
    expect(arr[0]).toBeCloseTo(CATALOG[0]!.ra);
    expect(arr[1]).toBeCloseTo(CATALOG[0]!.dec);
    expect(arr[2]).toBeCloseTo(CATALOG[1]!.ra);
    expect(arr[3]).toBeCloseTo(CATALOG[1]!.dec);
    expect(arr[4]).toBeCloseTo(CATALOG[2]!.ra);
    expect(arr[5]).toBeCloseTo(CATALOG[2]!.dec);
  });

  it("returns empty array for empty catalog", () => {
    const arr = buildRaDecArray([]);
    expect(arr.length).toBe(0);
  });
});

describe("buildAltAzStars", () => {
  it("returns only stars at the given visible indices", () => {
    // Simulate worker output: altAzs for all 3 stars, visibleIndices = [0, 1] (Polaris and Sirius)
    const altAzs = new Float64Array([
      45.0,
      180.0, // star 0: Polaris alt=45, az=180
      30.0,
      90.0, // star 1: Sirius alt=30, az=90
      -10.0,
      270.0, // star 2: Achernar (below horizon, not in visibleIndices)
    ]);
    const visibleIndices = new Uint16Array([0, 1]);
    const stars = buildAltAzStars(CATALOG, altAzs, visibleIndices);
    expect(stars).toHaveLength(2);
    expect(stars[0]!.name).toBe("Polaris");
    expect(stars[1]!.name).toBe("Sirius");
  });

  it("assigns correct alt and az from the altAzs array", () => {
    const altAzs = new Float64Array([45.0, 180.0, 30.0, 90.0, -10.0, 270.0]);
    const visibleIndices = new Uint16Array([0, 1]);
    const stars = buildAltAzStars(CATALOG, altAzs, visibleIndices);
    expect(stars[0]!.alt).toBeCloseTo(45.0);
    expect(stars[0]!.az).toBeCloseTo(180.0);
    expect(stars[1]!.alt).toBeCloseTo(30.0);
    expect(stars[1]!.az).toBeCloseTo(90.0);
  });

  it("includes hip, ra, dec, mag, name on each star", () => {
    const altAzs = new Float64Array([45.0, 180.0, 0.0, 0.0, 0.0, 0.0]);
    const visibleIndices = new Uint16Array([0]);
    const stars = buildAltAzStars(CATALOG, altAzs, visibleIndices);
    expect(stars[0]).toMatchObject({
      hip: 11767,
      ra: 37.9546,
      dec: 89.2641,
      mag: 2.02,
      name: "Polaris",
    });
  });

  it("populates size and opacity from magToVisual", () => {
    const altAzs = new Float64Array([45.0, 180.0, 0.0, 0.0, 0.0, 0.0]);
    const visibleIndices = new Uint16Array([0]);
    const stars = buildAltAzStars(CATALOG, altAzs, visibleIndices);
    expect(stars[0]!.size).toBeGreaterThanOrEqual(3);
    expect(stars[0]!.size).toBeLessThanOrEqual(16);
    expect(stars[0]!.opacity).toBeGreaterThanOrEqual(0.4);
    expect(stars[0]!.opacity).toBeLessThanOrEqual(1.0);
  });

  it("does not include name property for unnamed stars", () => {
    const unnamed: StarRecord[] = [{ hip: 99999, ra: 100, dec: 20, mag: 5.0 }];
    const altAzs = new Float64Array([10.0, 90.0]);
    const visibleIndices = new Uint16Array([0]);
    const stars = buildAltAzStars(unnamed, altAzs, visibleIndices);
    expect(stars).toHaveLength(1);
    expect("name" in stars[0]!).toBe(false);
  });

  it("returns empty array for empty visibleIndices", () => {
    const altAzs = new Float64Array([45.0, 180.0]);
    const visibleIndices = new Uint16Array([]);
    const stars = buildAltAzStars(CATALOG, altAzs, visibleIndices);
    expect(stars).toHaveLength(0);
  });

  it("handles all stars visible", () => {
    const altAzs = new Float64Array([10, 1, 20, 2, 30, 3]);
    const visibleIndices = new Uint16Array([0, 1, 2]);
    const stars = buildAltAzStars(CATALOG, altAzs, visibleIndices);
    expect(stars).toHaveLength(3);
  });
});
