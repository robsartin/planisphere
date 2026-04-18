/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";
import type { VisibleConstellation, VisibleLine } from "./constellations";
import type { AltAzStar } from "./visibility";

export type SkycultureId = "western" | "chinese";

export const SKYCULTURES: readonly SkycultureId[] = ["western", "chinese"];

export type AsterismConstellation = {
  readonly id: string;
  readonly name: string;
  /** Each entry is a polyline of HIP star ids (length >= 2). */
  readonly lines: readonly (readonly number[])[];
};

export type AsterismSet = {
  readonly id: string;
  readonly name: string;
  readonly constellations: readonly AsterismConstellation[];
};

export type AsterismParseError =
  | { kind: "asterism-invalid"; message: string }
  | { kind: "asterism-empty"; message: string };

const ID_SET = new Set<string>(SKYCULTURES);

export function isSkycultureId(value: string): value is SkycultureId {
  return ID_SET.has(value);
}

export function parseSkyculture(raw: string | null | undefined): SkycultureId {
  if (raw === null || raw === undefined) return "western";
  return isSkycultureId(raw) ? raw : "western";
}

export function parseAsterismSet(raw: unknown): Result<AsterismSet, AsterismParseError> {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return err({ kind: "asterism-invalid", message: "Asterism set must be a plain object" });
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || r.id.length === 0) {
    return err({ kind: "asterism-invalid", message: "Asterism set must have a string 'id'" });
  }
  if (!Array.isArray(r.constellations)) {
    return err({
      kind: "asterism-invalid",
      message: "Asterism set must have a 'constellations' array",
    });
  }
  const name = typeof r.name === "string" && r.name.length > 0 ? r.name : r.id;

  const constellations: AsterismConstellation[] = [];
  for (const entry of r.constellations) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || e.id.length === 0) continue;
    if (!Array.isArray(e.lines)) continue;

    const lines: number[][] = [];
    for (const poly of e.lines) {
      if (!Array.isArray(poly)) continue;
      const cleaned: number[] = [];
      let bad = false;
      for (const point of poly) {
        if (typeof point !== "number" || !Number.isFinite(point) || point <= 0) {
          bad = true;
          break;
        }
        cleaned.push(point);
      }
      if (bad) continue;
      if (cleaned.length >= 2) lines.push(cleaned);
    }
    if (lines.length === 0) continue;

    const entryName = typeof e.name === "string" && e.name.length > 0 ? e.name : e.id;
    constellations.push({ id: e.id, name: entryName, lines });
  }

  if (constellations.length === 0) {
    return err({ kind: "asterism-empty", message: "Asterism set has no valid constellations" });
  }

  return ok({ id: r.id, name, constellations });
}

/** Flatten polylines into consecutive [start, end] HIP pairs for line rendering. */
export function asterismLines(set: AsterismSet): [number, number][] {
  const segments: [number, number][] = [];
  for (const constellation of set.constellations) {
    for (const poly of constellation.lines) {
      for (let i = 0; i + 1 < poly.length; i += 1) {
        segments.push([poly[i]!, poly[i + 1]!]);
      }
    }
  }
  return segments;
}

/**
 * Resolve HIP ids in an asterism set to alt/az positions using the visible-star map.
 * Segments where either endpoint is not currently above the horizon are dropped.
 * Constellations with no visible segments are omitted from the result.
 */
export function filterVisibleAsterisms(
  set: AsterismSet,
  visibleStars: readonly AltAzStar[],
): VisibleConstellation[] {
  const starMap = new Map<number, AltAzStar>();
  for (const s of visibleStars) starMap.set(s.hip, s);

  const result: VisibleConstellation[] = [];
  for (const constellation of set.constellations) {
    const lines: VisibleLine[] = [];
    let altSum = 0;
    let azSum = 0;
    let pointCount = 0;

    for (const poly of constellation.lines) {
      for (let i = 0; i + 1 < poly.length; i += 1) {
        const a = starMap.get(poly[i]!);
        const b = starMap.get(poly[i + 1]!);
        if (a === undefined || b === undefined) continue;
        if (a.alt <= 0 || b.alt <= 0) continue;
        lines.push({ start: { alt: a.alt, az: a.az }, end: { alt: b.alt, az: b.az } });
        altSum += a.alt + b.alt;
        azSum += a.az + b.az;
        pointCount += 2;
      }
    }

    if (lines.length > 0 && pointCount > 0) {
      result.push({
        id: constellation.id,
        name: constellation.name,
        lines,
        centroid: { alt: altSum / pointCount, az: azSum / pointCount },
      });
    }
  }

  return result;
}
