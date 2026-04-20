/* SPDX-License-Identifier: Apache-2.0 */
import { describe, expect, it } from "vitest";
import { resolveEntityLabel, searchEntities, type EntityKind } from "./entities";

/**
 * Catalog used by the Notebook's @-mention popover (ADR 013). Source data:
 * `data/constellations.json` (88 IAU), `data/meteor-showers.json` (annual
 * IMO calendar), and a hardcoded list of the planisphere's named bodies
 * (matches `src/astro/search.ts` BODY_MAP — Sun, Moon, Mercury…Saturn).
 */

describe("resolveEntityLabel", () => {
  it("returns the display label for a known body", () => {
    expect(resolveEntityLabel({ kind: "body", id: "Sun" })).toBe("Sun");
    expect(resolveEntityLabel({ kind: "body", id: "Mars" })).toBe("Mars");
  });

  it("returns the IAU name for a known constellation", () => {
    expect(resolveEntityLabel({ kind: "constellation", id: "And" })).toBe("Andromeda");
    expect(resolveEntityLabel({ kind: "constellation", id: "Ori" })).toBe("Orion");
  });

  it("returns the meteor-shower name for a known event", () => {
    expect(resolveEntityLabel({ kind: "event", id: "perseids" })).toBe("Perseids");
  });

  it("returns null for an unknown id", () => {
    expect(resolveEntityLabel({ kind: "body", id: "Pluto" })).toBeNull();
    expect(resolveEntityLabel({ kind: "constellation", id: "Zzz" })).toBeNull();
    expect(resolveEntityLabel({ kind: "event", id: "made-up-shower" })).toBeNull();
  });

  it("returns null for an unknown kind", () => {
    expect(resolveEntityLabel({ kind: "nope" as EntityKind, id: "x" })).toBeNull();
  });
});

describe("searchEntities", () => {
  it("returns case-insensitive substring matches", () => {
    const results = searchEntities("ori");
    const labels = results.map((r) => r.label);
    expect(labels).toContain("Orion");
  });

  it("matches across kinds", () => {
    const results = searchEntities("ar"); // Mars (body), Aries (constellation), …
    const kinds = new Set(results.map((r) => r.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });

  it("respects the limit argument", () => {
    const results = searchEntities("a", 5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("defaults to a sensible upper bound", () => {
    const results = searchEntities("a");
    expect(results.length).toBeLessThanOrEqual(8);
  });

  it("returns an empty list for an empty query", () => {
    expect(searchEntities("")).toEqual([]);
    expect(searchEntities("   ")).toEqual([]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchEntities("zzznosuchthing")).toEqual([]);
  });

  it("trims and lowercases the query", () => {
    expect(searchEntities("  ORION  ").map((r) => r.label)).toContain("Orion");
  });

  it("each result carries kind + id + label", () => {
    const results = searchEntities("perseids");
    expect(results.length).toBeGreaterThan(0);
    const first = results[0]!;
    expect(first.kind).toBe("event");
    expect(first.id).toBe("perseids");
    expect(first.label).toBe("Perseids");
  });

  it("results are stably ordered (alphabetical by label)", () => {
    const a = searchEntities("a", 8).map((r) => r.label);
    const b = searchEntities("a", 8).map((r) => r.label);
    expect(a).toEqual(b);
    const sorted = [...a].sort((x, y) => x.localeCompare(y));
    expect(a).toEqual(sorted);
  });
});
