/* SPDX-License-Identifier: Apache-2.0 */
import type { StarRecord } from "./catalog";
import type { ConstellationRecord } from "./constellations";
import type { SatelliteRecord } from "../sat/tle";
import { fastRaDecToAltAz } from "./fast-coords";
import { Body, Equator, MakeTime, Observer } from "astronomy-engine";
import { raDecToAltAz } from "./coords";

export type SearchResultType = "star" | "constellation" | "body" | "satellite";

export type SearchResult = {
  readonly name: string;
  readonly type: SearchResultType;
  readonly alt: number;
  readonly az: number;
  readonly belowHorizon: boolean;
};

type IndexEntry = {
  readonly name: string;
  readonly nameLower: string;
  readonly type: SearchResultType;
  readonly alt: number;
  readonly az: number;
};

export type SearchIndex = {
  readonly entries: readonly IndexEntry[];
};

/** Map body id string to astronomy-engine Body enum value */
const BODY_MAP: Record<string, Body> = {
  Sun: Body.Sun,
  Moon: Body.Moon,
  Mercury: Body.Mercury,
  Venus: Body.Venus,
  Mars: Body.Mars,
  Jupiter: Body.Jupiter,
  Saturn: Body.Saturn,
};

function bodyAltAz(
  bodyId: string,
  lat: number,
  lon: number,
  time: Date,
): { alt: number; az: number } {
  const body = BODY_MAP[bodyId];
  if (body === undefined) return { alt: 0, az: 0 };
  try {
    const astroTime = MakeTime(time);
    const observer = new Observer(lat, lon, 0);
    const eq = Equator(body, astroTime, observer, true, true);
    return raDecToAltAz(eq.ra * 15, eq.dec, lat, lon, time);
  } catch {
    return { alt: 0, az: 0 };
  }
}

/**
 * Build a searchable index from all data sources.
 *
 * All alt/az positions are computed at the given lat/lon/time and cached in the index.
 * Constellations without a valid RA/Dec representative point use alt=0/az=0 as a fallback;
 * the centroid is not recomputed here since that requires visible stars, which are not
 * available at index-build time. Instead we use the first hip from the constellation lines
 * as a representative star position if it exists in the star catalog.
 */
export function buildSearchIndex(
  stars: StarRecord[],
  constellations: ConstellationRecord[],
  bodyNames: string[],
  satellites: SatelliteRecord[],
  lat: number,
  lon: number,
  time: Date,
): SearchIndex {
  const entries: IndexEntry[] = [];

  // Build a HIP → StarRecord map for constellation representative positions
  const starByHip = new Map<number, StarRecord>();
  for (const s of stars) {
    starByHip.set(s.hip, s);
  }

  // Named stars
  for (const star of stars) {
    if (!star.name) continue;
    const { alt, az } = fastRaDecToAltAz(star.ra, star.dec, lat, lon, time);
    entries.push({ name: star.name, nameLower: star.name.toLowerCase(), type: "star", alt, az });
  }

  // Constellations — use first referenced star as representative position
  for (const constellation of constellations) {
    let alt = 0;
    let az = 0;
    // Find first hip reference in this constellation's lines
    outer: for (const line of constellation.lines) {
      for (const hip of line) {
        const rep = starByHip.get(hip);
        if (rep) {
          const coords = fastRaDecToAltAz(rep.ra, rep.dec, lat, lon, time);
          alt = coords.alt;
          az = coords.az;
          break outer;
        }
      }
    }
    entries.push({
      name: constellation.name,
      nameLower: constellation.name.toLowerCase(),
      type: "constellation",
      alt,
      az,
    });
  }

  // Bodies (solar system)
  for (const name of bodyNames) {
    const { alt, az } = bodyAltAz(name, lat, lon, time);
    entries.push({ name, nameLower: name.toLowerCase(), type: "body", alt, az });
  }

  // Satellites
  // We store satellites with alt=0/az=0 because their positions are time-dependent and
  // already propagated separately. The search index is built once; callers should treat
  // satellite positions as approximate and re-propagate on selection if precision matters.
  for (const sat of satellites) {
    entries.push({
      name: sat.name,
      nameLower: sat.name.toLowerCase(),
      type: "satellite",
      alt: 0,
      az: 0,
    });
  }

  return { entries };
}

const MAX_RESULTS = 10;

/**
 * Search the index for objects matching the query.
 *
 * Matching is case-insensitive substring/prefix match. Returns at most 10 results.
 * Returns empty array for queries shorter than 2 characters.
 */
export function searchObjects(index: SearchIndex, query: string): SearchResult[] {
  if (query.length < 2) return [];

  const q = query.toLowerCase();
  const results: SearchResult[] = [];

  for (const entry of index.entries) {
    if (results.length >= MAX_RESULTS) break;
    if (entry.nameLower.includes(q)) {
      results.push({
        name: entry.name,
        type: entry.type,
        alt: entry.alt,
        az: entry.az,
        belowHorizon: entry.alt <= 0,
      });
    }
  }

  return results;
}
