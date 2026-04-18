/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { expectOk, isErr, isOk } from "../result";
import {
  parseAsterismSet,
  SKYCULTURES,
  isSkycultureId,
  parseSkyculture,
  asterismLines,
  filterVisibleAsterisms,
  type SkycultureId,
  type AsterismSet,
} from "./skycultures";
import type { AltAzStar } from "./visibility";

describe("SKYCULTURES", () => {
  it("has 'western' as the first (default) skyculture", () => {
    expect(SKYCULTURES[0]).toBe("western");
  });

  it("includes all supported skyculture ids", () => {
    const ids: SkycultureId[] = ["western", "chinese"];
    for (const id of ids) {
      expect(SKYCULTURES).toContain(id);
    }
  });
});

describe("isSkycultureId", () => {
  it("returns true for known ids", () => {
    expect(isSkycultureId("western")).toBe(true);
    expect(isSkycultureId("chinese")).toBe(true);
  });

  it("returns false for unknown ids", () => {
    expect(isSkycultureId("klingon")).toBe(false);
    expect(isSkycultureId("")).toBe(false);
  });
});

describe("parseSkyculture", () => {
  it("returns 'western' for null/undefined", () => {
    expect(parseSkyculture(null)).toBe("western");
    expect(parseSkyculture(undefined)).toBe("western");
  });

  it("returns 'western' for unknown id", () => {
    expect(parseSkyculture("garbage")).toBe("western");
  });

  it("returns the id for known ids", () => {
    expect(parseSkyculture("chinese")).toBe("chinese");
    expect(parseSkyculture("western")).toBe("western");
  });
});

describe("parseAsterismSet", () => {
  it("parses a valid polyline-format asterism set", () => {
    const raw = {
      id: "chinese",
      name: "Chinese (Xingguan)",
      constellations: [
        { id: "CON chinese 001", name: "Net", lines: [[20889, 20648, 20455]] },
        { id: "CON chinese 003", name: "Three Stars", lines: [[27989, 26727], [26727, 27366]] },
      ],
    };
    const r = parseAsterismSet(raw);
    expect(isOk(r)).toBe(true);
    const set = expectOk(r);
    expect(set.id).toBe("chinese");
    expect(set.name).toBe("Chinese (Xingguan)");
    expect(set.constellations.length).toBe(2);
    expect(set.constellations[0]!.id).toBe("CON chinese 001");
    expect(set.constellations[0]!.name).toBe("Net");
    expect(set.constellations[0]!.lines.length).toBe(1);
    expect(set.constellations[0]!.lines[0]).toEqual([20889, 20648, 20455]);
  });

  it("returns Err for non-object input", () => {
    const r = parseAsterismSet("not an object");
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("asterism-invalid");
  });

  it("returns Err for null", () => {
    const r = parseAsterismSet(null);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("asterism-invalid");
  });

  it("returns Err when id is missing", () => {
    const raw = { name: "X", constellations: [] };
    const r = parseAsterismSet(raw);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("asterism-invalid");
  });

  it("returns Err when constellations is not an array", () => {
    const raw = { id: "x", name: "X", constellations: "oops" };
    const r = parseAsterismSet(raw);
    expect(isErr(r)).toBe(true);
  });

  it("returns Err when constellations list has no valid entries", () => {
    const raw = { id: "x", name: "X", constellations: [] };
    const r = parseAsterismSet(raw);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) expect(r.error.kind).toBe("asterism-empty");
  });

  it("skips entries without valid id or lines", () => {
    const raw = {
      id: "x",
      name: "X",
      constellations: [
        { id: 5, name: "bad", lines: [[1, 2]] },
        { id: "ok", name: "ok", lines: [[1, 2, 3]] },
        { id: "noLines", name: "noLines" },
        { id: "emptyLines", name: "el", lines: [] },
      ],
    };
    const r = parseAsterismSet(raw);
    const set = expectOk(r);
    expect(set.constellations.length).toBe(1);
    expect(set.constellations[0]!.id).toBe("ok");
  });

  it("skips polylines that contain non-finite HIP ids", () => {
    const raw = {
      id: "x",
      name: "X",
      constellations: [
        { id: "c", name: "c", lines: [[1, "bad", 3], [4, 5]] },
      ],
    };
    const set = expectOk(parseAsterismSet(raw));
    expect(set.constellations[0]!.lines.length).toBe(1);
    expect(set.constellations[0]!.lines[0]).toEqual([4, 5]);
  });

  it("skips polylines with fewer than 2 points", () => {
    const raw = {
      id: "x",
      name: "X",
      constellations: [
        { id: "c", name: "c", lines: [[1], [1, 2]] },
      ],
    };
    const set = expectOk(parseAsterismSet(raw));
    expect(set.constellations[0]!.lines.length).toBe(1);
    expect(set.constellations[0]!.lines[0]).toEqual([1, 2]);
  });

  it("uses id as name when name is missing", () => {
    const raw = {
      id: "x",
      name: "X",
      constellations: [{ id: "unnamed", lines: [[1, 2]] }],
    };
    const set = expectOk(parseAsterismSet(raw));
    expect(set.constellations[0]!.name).toBe("unnamed");
  });
});

describe("filterVisibleAsterisms", () => {
  function star(hip: number, alt: number, az: number): AltAzStar {
    return { hip, ra: 0, dec: 0, alt, az, mag: 2, size: 1, opacity: 1 };
  }

  const set: AsterismSet = {
    id: "chinese",
    name: "Chinese",
    constellations: [
      { id: "A", name: "Net", lines: [[1, 2, 3]] }, // 2 segments
      { id: "B", name: "Wall", lines: [[10, 11]] },
    ],
  };

  it("produces VisibleConstellation entries for polylines whose stars are above horizon", () => {
    const visibleStars: AltAzStar[] = [
      star(1, 30, 100),
      star(2, 40, 110),
      star(3, 50, 120),
      star(10, 20, 30),
      star(11, 25, 35),
    ];
    const v = filterVisibleAsterisms(set, visibleStars);
    expect(v.length).toBe(2);
    const a = v.find((c) => c.id === "A")!;
    expect(a.lines.length).toBe(2);
    expect(a.name).toBe("Net");
    expect(a.centroid.alt).toBeGreaterThan(0);
  });

  it("skips segments where either endpoint is not in the visible star map", () => {
    const visibleStars: AltAzStar[] = [star(1, 30, 100), star(2, 40, 110)]; // 3 missing
    const v = filterVisibleAsterisms(set, visibleStars);
    const a = v.find((c) => c.id === "A");
    // Only segment 1-2 is fully visible
    expect(a?.lines.length).toBe(1);
  });

  it("omits constellations with no visible segments", () => {
    const visibleStars: AltAzStar[] = [star(1, 30, 100)];
    const v = filterVisibleAsterisms(set, visibleStars);
    expect(v.find((c) => c.id === "A")).toBeUndefined();
    expect(v.find((c) => c.id === "B")).toBeUndefined();
  });
});

describe("asterismLines", () => {
  it("flattens polylines into [start, end] segment pairs", () => {
    const set = {
      id: "chinese",
      name: "Chinese",
      constellations: [
        { id: "A", name: "A", lines: [[1, 2, 3, 4]] }, // 3 segments
        { id: "B", name: "B", lines: [[10, 11], [20, 21]] }, // 2 segments
      ],
    };
    const segments = asterismLines(set);
    expect(segments).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
      [10, 11],
      [20, 21],
    ]);
  });

  it("returns empty array for empty set", () => {
    const set = { id: "x", name: "X", constellations: [] };
    expect(asterismLines(set)).toEqual([]);
  });
});
