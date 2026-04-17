/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { isErr, isOk, expectOk } from "../result";
import { parseConstellations, filterVisibleConstellations } from "./constellations";
import type { AltAzStar } from "./visibility";

const VALID_DATA = [
  {
    id: "Ori",
    name: "Orion",
    lines: [
      [27366, 26311],
      [26311, 25336],
      [25336, 25930],
    ],
  },
  {
    id: "UMa",
    name: "Ursa Major",
    lines: [
      [54061, 53910],
      [53910, 58001],
    ],
  },
];

describe("parseConstellations", () => {
  it("parses valid constellation array", () => {
    const r = parseConstellations(VALID_DATA);
    expect(isOk(r)).toBe(true);
    const data = expectOk(r);
    expect(data).toHaveLength(2);
    expect(data[0]!.id).toBe("Ori");
    expect(data[0]!.lines).toHaveLength(3);
  });

  it("returns Err for non-array input", () => {
    const r = parseConstellations("not an array");
    expect(isErr(r)).toBe(true);
  });

  it("returns Err for empty array", () => {
    const r = parseConstellations([]);
    expect(isErr(r)).toBe(true);
  });

  it("skips entries with missing id or name", () => {
    const data = [
      { id: "Ori", name: "Orion", lines: [[1, 2]] },
      { name: "Bad", lines: [[3, 4]] },
    ];
    const result = expectOk(parseConstellations(data));
    expect(result).toHaveLength(1);
  });
});

describe("filterVisibleConstellations", () => {
  const starMap: AltAzStar[] = [
    { hip: 27366, ra: 88.79, dec: 7.41, alt: 45, az: 180, mag: 0.5, size: 14, opacity: 0.95 },
    { hip: 26311, ra: 81.28, dec: 6.35, alt: 30, az: 170, mag: 1.7, size: 10, opacity: 0.8 },
    { hip: 25336, ra: 78.63, dec: -8.2, alt: -5, az: 160, mag: 2.1, size: 9, opacity: 0.75 },
    { hip: 25930, ra: 80.0, dec: -1.0, alt: 20, az: 165, mag: 1.9, size: 9, opacity: 0.78 },
    { hip: 54061, ra: 166.45, dec: 61.75, alt: 60, az: 350, mag: 1.8, size: 10, opacity: 0.8 },
    { hip: 53910, ra: 165.93, dec: 61.45, alt: 58, az: 348, mag: 2.4, size: 8, opacity: 0.7 },
    { hip: 58001, ra: 178.46, dec: 53.69, alt: 55, az: 340, mag: 2.4, size: 8, opacity: 0.7 },
  ];

  const constellations = expectOk(parseConstellations(VALID_DATA));

  it("includes lines where both stars are visible", () => {
    const result = filterVisibleConstellations(constellations, starMap);
    const uma = result.find((c) => c.id === "UMa");
    expect(uma).toBeDefined();
    expect(uma!.lines).toHaveLength(2);
  });

  it("excludes lines where one star is below horizon", () => {
    const result = filterVisibleConstellations(constellations, starMap);
    const ori = result.find((c) => c.id === "Ori");
    expect(ori).toBeDefined();
    // star 25336 is at alt=-5, so lines involving it are excluded
    // Line [27366,26311] both visible, [26311,25336] one below, [25336,25930] one below
    expect(ori!.lines).toHaveLength(1);
  });

  it("excludes constellations with no visible lines", () => {
    const noStars: AltAzStar[] = [];
    const result = filterVisibleConstellations(constellations, noStars);
    expect(result).toHaveLength(0);
  });

  it("computes centroid from visible endpoints", () => {
    const result = filterVisibleConstellations(constellations, starMap);
    const uma = result.find((c) => c.id === "UMa");
    expect(uma).toBeDefined();
    expect(uma!.centroid.alt).toBeGreaterThan(0);
    expect(uma!.centroid.az).toBeGreaterThan(0);
  });
});
