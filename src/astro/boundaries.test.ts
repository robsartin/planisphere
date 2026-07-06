/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { isErr, isOk, expectOk } from "../result";
import { parseBoundaries, filterVisibleBoundaries } from "./boundaries";
import type { BoundaryRecord } from "./boundaries";

const VALID_DATA = [
  {
    id: "Ori",
    vertices: [
      { ra: 75.0, dec: 10.0 },
      { ra: 90.0, dec: 10.0 },
      { ra: 90.0, dec: -10.0 },
      { ra: 75.0, dec: -10.0 },
    ],
  },
  {
    id: "UMa",
    vertices: [
      { ra: 150.0, dec: 55.0 },
      { ra: 180.0, dec: 55.0 },
      { ra: 180.0, dec: 40.0 },
      { ra: 150.0, dec: 40.0 },
    ],
  },
];

describe("parseBoundaries", () => {
  it("parses valid boundary array", () => {
    const r = parseBoundaries(VALID_DATA);
    expect(isOk(r)).toBe(true);
    const data = expectOk(r);
    expect(data).toHaveLength(2);
    expect(data[0]!.id).toBe("Ori");
    expect(data[0]!.vertices).toHaveLength(4);
  });

  it("returns Err for non-array input", () => {
    const r = parseBoundaries("not an array");
    expect(isErr(r)).toBe(true);
  });

  it("returns Err for empty array", () => {
    const r = parseBoundaries([]);
    expect(isErr(r)).toBe(true);
  });

  it("skips entries missing id", () => {
    const data = [
      {
        id: "Ori",
        vertices: [
          { ra: 0, dec: 0 },
          { ra: 10, dec: 0 },
          { ra: 10, dec: 10 },
        ],
      },
      {
        vertices: [
          { ra: 0, dec: 0 },
          { ra: 5, dec: 0 },
          { ra: 5, dec: 5 },
        ],
      },
    ];
    const result = expectOk(parseBoundaries(data));
    expect(result).toHaveLength(1);
  });

  it("skips entries with fewer than 3 vertices", () => {
    const data = [
      {
        id: "Ori",
        vertices: [
          { ra: 0, dec: 0 },
          { ra: 10, dec: 0 },
          { ra: 10, dec: 10 },
        ],
      },
      { id: "Bad", vertices: [{ ra: 0, dec: 0 }] },
    ];
    const result = expectOk(parseBoundaries(data));
    expect(result).toHaveLength(1);
  });

  it("returns Err when no valid entries remain", () => {
    const r = parseBoundaries([{ id: "Bad", vertices: [] }]);
    expect(isErr(r)).toBe(true);
  });
});

describe("filterVisibleBoundaries", () => {
  // Observer at lat=40, lon=0, time=2026-04-15T00:00:00Z
  // We test structural filtering: a boundary is included if ≥1 vertex is above horizon.
  // For unit tests we inject a custom isAboveHorizon predicate.

  const LAT = 40;
  const LON = 0;
  const TIME = new Date("2026-04-15T00:00:00Z");
  const records = expectOk(parseBoundaries(VALID_DATA));

  it("returns an array", () => {
    const result = filterVisibleBoundaries(records, LAT, LON, TIME);
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array for empty input", () => {
    const result = filterVisibleBoundaries([], LAT, LON, TIME);
    expect(result).toHaveLength(0);
  });

  it("excludes boundary when all vertices are below horizon (alt < 0)", () => {
    // Manufacture a boundary whose vertices all produce alt < 0 by placing them
    // directly opposite the zenith (dec = -(90 - lat) for a culminating point).
    // For lat=40, dec=-50 at RA=LST+180 should be below horizon.
    const belowHorizon: BoundaryRecord[] = [
      {
        id: "Below",
        vertices: [
          { ra: 0, dec: -80 },
          { ra: 10, dec: -80 },
          { ra: 10, dec: -70 },
          { ra: 0, dec: -70 },
        ],
      },
    ];
    // Inject a stub that always says below horizon
    const result = filterVisibleBoundaries(belowHorizon, LAT, LON, TIME, () => -10);
    expect(result).toHaveLength(0);
  });

  it("includes boundary when at least one vertex is above horizon", () => {
    const mixed: BoundaryRecord[] = [
      {
        id: "Mixed",
        vertices: [
          { ra: 0, dec: 80 },
          { ra: 10, dec: -80 },
          { ra: 10, dec: -80 },
        ],
      },
    ];
    // Inject a stub that returns positive alt for first vertex, negative for others
    let callCount = 0;
    const stub = () => (callCount++ === 0 ? 45 : -10);
    const result = filterVisibleBoundaries(mixed, LAT, LON, TIME, stub);
    expect(result).toHaveLength(1);
  });

  it("populates `name` from the provided namesByCode map (regression for #307)", () => {
    const namesByCode = new Map<string, string>([
      ["Ori", "Orion"],
      ["UMa", "Ursa Major"],
    ]);
    const result = filterVisibleBoundaries(records, LAT, LON, TIME, {
      namesByCode,
      // Force all boundaries visible so the assertion is deterministic across time.
      altFn: () => 30,
    });
    expect(result.map((b) => `${b.id}=${b.name}`).sort()).toEqual(["Ori=Orion", "UMa=Ursa Major"]);
  });

  it("falls back to the IAU code when the name map lacks an entry", () => {
    const result = filterVisibleBoundaries(records, LAT, LON, TIME, {
      namesByCode: new Map<string, string>([["Ori", "Orion"]]),
      altFn: () => 30,
    });
    const uma = result.find((b) => b.id === "UMa");
    expect(uma?.name).toBe("UMa");
  });

  it("falls back to the IAU code when no options are given at all", () => {
    const result = filterVisibleBoundaries(records, LAT, LON, TIME, () => 30);
    for (const b of result) {
      expect(b.name).toBe(b.id);
    }
  });
});
