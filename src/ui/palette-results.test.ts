/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import {
  buildPaletteResults,
  fuzzyScore,
  type PaletteSources,
  type PaletteResult,
} from "./palette-results";

function sources(overrides: Partial<PaletteSources> = {}): PaletteSources {
  return {
    objects: [],
    events: [],
    places: [],
    settings: [],
    recents: [],
    ...overrides,
  };
}

describe("fuzzyScore", () => {
  it("exact match (case-insensitive) outranks prefix and substring", () => {
    const exact = fuzzyScore("sirius", "sirius");
    const prefix = fuzzyScore("siri", "sirius");
    const substring = fuzzyScore("ius", "sirius");
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
  });

  it("prefix outranks substring and subsequence", () => {
    const prefix = fuzzyScore("orio", "orion");
    const substring = fuzzyScore("rio", "orion");
    const sub = fuzzyScore("on", "orion");
    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThanOrEqual(sub);
  });

  it("subsequence matches return a positive score", () => {
    // "srs" appears in order inside "sirius"
    expect(fuzzyScore("srs", "sirius")).toBeGreaterThan(0);
  });

  it("no match returns 0", () => {
    expect(fuzzyScore("xyz", "sirius")).toBe(0);
  });

  it("empty query returns 0 (caller should special-case empty)", () => {
    expect(fuzzyScore("", "sirius")).toBe(0);
  });
});

describe("buildPaletteResults", () => {
  it("empty query returns recents first, then settings as a help list", () => {
    const s = sources({
      settings: [
        { id: "toggle-night-vision", label: "Toggle night vision" },
        { id: "copy-link", label: "Copy link" },
      ],
      recents: [{ id: "copy-link", label: "Copy link" }],
    });
    const results = buildPaletteResults("", s);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]!.kind).toBe("recent");
    expect(results[0]!.label).toBe("Copy link");
  });

  it("ranks exact matches above prefix above substring", () => {
    const s = sources({
      objects: [
        { id: "orion", label: "Orion", type: "constellation" },
        { id: "orionis", label: "Orionis", type: "star" },
        { id: "foreign", label: "Foreigner-Orion-ish", type: "star" },
      ],
    });
    const results = buildPaletteResults("orion", s);
    const labels = results.map((r) => r.label);
    expect(labels[0]).toBe("Orion"); // exact
    expect(labels[1]).toBe("Orionis"); // prefix
    expect(labels[2]).toBe("Foreigner-Orion-ish"); // substring
  });

  it("filters out results that don't match the query at all", () => {
    const s = sources({
      objects: [
        { id: "mars", label: "Mars", type: "body" },
        { id: "sirius", label: "Sirius", type: "star" },
      ],
    });
    const results = buildPaletteResults("zz", s);
    expect(results).toHaveLength(0);
  });

  it("ties broken by source priority (action > object > event > place)", () => {
    const s = sources({
      objects: [{ id: "alpha", label: "Alpha", type: "star" }],
      events: [{ id: "e1", label: "Alpha", description: "Alpha event" }],
      places: [{ id: "p1", label: "Alpha", lat: 0, lon: 0 }],
      settings: [{ id: "s1", label: "Alpha" }],
    });
    const results = buildPaletteResults("alpha", s);
    expect(results.map((r) => r.kind)).toEqual(["action", "object", "event", "place"]);
  });

  it("returns at most MAX_RESULTS entries", () => {
    const objects = Array.from({ length: 100 }, (_, i) => ({
      id: `obj-${String(i)}`,
      label: `Obj-${String(i)}`,
      type: "star" as const,
    }));
    const results = buildPaletteResults("obj", sources({ objects }));
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it("each result carries through the source-specific payload", () => {
    const s = sources({
      places: [{ id: "lon", label: "London", lat: 51.5, lon: -0.12 }],
    });
    const results = buildPaletteResults("lond", s);
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r.kind).toBe("place");
    if (r.kind === "place") {
      expect(r.lat).toBe(51.5);
      expect(r.lon).toBe(-0.12);
    }
  });

  it("empty query ignores recents when recents is empty", () => {
    const s = sources({
      settings: [{ id: "nv", label: "Night vision" }],
    });
    const results = buildPaletteResults("", s);
    // At least the settings entry should appear as fallback
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.kind !== "recent")).toBe(true);
  });

  it("case-insensitive matching", () => {
    const s = sources({ objects: [{ id: "a", label: "SIRIUS", type: "star" }] });
    expect(buildPaletteResults("sir", s)).toHaveLength(1);
    expect(buildPaletteResults("SIR", s)).toHaveLength(1);
  });

  it("query shorter than 1 char with no recents returns a help/fallback list", () => {
    const s = sources({
      settings: [
        { id: "nv", label: "Night vision" },
        { id: "cl", label: "Copy link" },
      ],
    });
    const results: readonly PaletteResult[] = buildPaletteResults("", s);
    expect(results.length).toBe(2);
    expect(results.map((r) => r.kind)).toEqual(["action", "action"]);
  });
});
