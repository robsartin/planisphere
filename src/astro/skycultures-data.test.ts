/* SPDX-License-Identifier: Apache-2.0 */
/**
 * Smoke tests for the bundled skyculture JSON files under data/asterisms/.
 *
 * We don't hand-edit the non-Western files — they come from Stellarium via
 * scripts/build-asterisms.mjs. These tests guard the invariants the app
 * relies on: each file parses cleanly, has a sensible minimum number of
 * constellations, and filterVisibleAsterisms works against a synthetic
 * above-horizon star map.
 */
import { describe, expect, it } from "vitest";
import { expectOk } from "../result";
import { parseAsterismSet, filterVisibleAsterisms, type SkycultureId } from "./skycultures";
import type { AltAzStar } from "./visibility";
import rawWestern from "../../data/asterisms/western.json";
import rawChinese from "../../data/asterisms/chinese.json";
import rawIndian from "../../data/asterisms/indian.json";
import rawNorseEdda from "../../data/asterisms/norse_edda.json";
import rawHawaiian from "../../data/asterisms/hawaiian_starlines.json";
import rawMaori from "../../data/asterisms/maori.json";

type Case = {
  id: SkycultureId;
  raw: unknown;
  minConstellations: number;
  expectedName: string;
};

const CASES: Case[] = [
  { id: "western", raw: rawWestern, minConstellations: 80, expectedName: "Western (IAU)" },
  { id: "chinese", raw: rawChinese, minConstellations: 250, expectedName: "Chinese (Xingguan)" },
  { id: "indian", raw: rawIndian, minConstellations: 40, expectedName: "Indian (Vedic)" },
  { id: "norse_edda", raw: rawNorseEdda, minConstellations: 15, expectedName: "Norse (Edda)" },
  {
    id: "hawaiian_starlines",
    raw: rawHawaiian,
    minConstellations: 10,
    expectedName: "Hawaiian Starlines",
  },
  { id: "maori", raw: rawMaori, minConstellations: 5, expectedName: "Māori" },
];

describe("bundled skyculture JSON", () => {
  for (const c of CASES) {
    describe(c.id, () => {
      it("parses cleanly", () => {
        const set = expectOk(parseAsterismSet(c.raw));
        expect(set.id).toBe(c.id);
        expect(set.name).toBe(c.expectedName);
      });

      it(`has at least ${c.minConstellations} constellations`, () => {
        const set = expectOk(parseAsterismSet(c.raw));
        expect(set.constellations.length).toBeGreaterThanOrEqual(c.minConstellations);
      });

      it("every constellation has at least one valid polyline", () => {
        const set = expectOk(parseAsterismSet(c.raw));
        for (const con of set.constellations) {
          expect(con.lines.length).toBeGreaterThan(0);
          for (const poly of con.lines) {
            expect(poly.length).toBeGreaterThanOrEqual(2);
            for (const hip of poly) {
              expect(Number.isFinite(hip)).toBe(true);
              expect(hip).toBeGreaterThan(0);
            }
          }
        }
      });

      it("filterVisibleAsterisms returns something when every HIP is above horizon", () => {
        const set = expectOk(parseAsterismSet(c.raw));
        // Collect every unique HIP referenced in the set
        const hips = new Set<number>();
        for (const con of set.constellations) {
          for (const poly of con.lines) {
            for (const hip of poly) hips.add(hip);
          }
        }
        const visibleStars: AltAzStar[] = [...hips].map((hip, i) => ({
          hip,
          ra: 0,
          dec: 0,
          alt: 30,
          // Spread azimuths to keep centroids well-defined
          az: (i * 7) % 360,
          mag: 2,
          size: 1,
          opacity: 1,
        }));
        const visible = filterVisibleAsterisms(set, visibleStars);
        expect(visible.length).toBe(set.constellations.length);
      });
    });
  }
});
