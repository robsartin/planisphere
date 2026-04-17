/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";
import type { AltAzStar } from "./visibility";

export type ConstellationRecord = {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly (readonly [number, number])[];
};

export type ConstellationLoadError = { kind: "constellation-load-failed"; message: string };

export type VisibleLine = {
  readonly start: { readonly alt: number; readonly az: number };
  readonly end: { readonly alt: number; readonly az: number };
};

export type VisibleConstellation = {
  readonly id: string;
  readonly name: string;
  readonly lines: readonly VisibleLine[];
  readonly centroid: { readonly alt: number; readonly az: number };
};

export function parseConstellations(
  raw: unknown,
): Result<ConstellationRecord[], ConstellationLoadError> {
  if (!Array.isArray(raw)) {
    return err({
      kind: "constellation-load-failed",
      message: "Constellation data is not an array",
    });
  }
  if (raw.length === 0) {
    return err({ kind: "constellation-load-failed", message: "Constellation data is empty" });
  }

  const result: ConstellationRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || typeof e.name !== "string") continue;
    if (!Array.isArray(e.lines)) continue;

    const lines: [number, number][] = [];
    for (const pair of e.lines) {
      if (Array.isArray(pair) && pair.length >= 2) {
        const a = Number(pair[0]);
        const b = Number(pair[1]);
        if (Number.isFinite(a) && Number.isFinite(b) && a > 0 && b > 0) {
          lines.push([a, b]);
        }
      }
    }
    if (lines.length > 0) {
      result.push({ id: e.id, name: e.name, lines });
    }
  }

  if (result.length === 0) {
    return err({
      kind: "constellation-load-failed",
      message: "No valid constellations after parsing",
    });
  }
  return ok(result);
}

export function filterVisibleConstellations(
  constellations: ConstellationRecord[],
  visibleStars: AltAzStar[],
): VisibleConstellation[] {
  const starMap = new Map<number, AltAzStar>();
  for (const star of visibleStars) {
    starMap.set(star.hip, star);
  }

  const result: VisibleConstellation[] = [];
  for (const constellation of constellations) {
    const visibleLines: VisibleLine[] = [];
    let altSum = 0;
    let azSum = 0;
    let pointCount = 0;

    for (const [hipA, hipB] of constellation.lines) {
      const starA = starMap.get(hipA);
      const starB = starMap.get(hipB);
      if (starA && starB && starA.alt > 0 && starB.alt > 0) {
        visibleLines.push({
          start: { alt: starA.alt, az: starA.az },
          end: { alt: starB.alt, az: starB.az },
        });
        altSum += starA.alt + starB.alt;
        azSum += starA.az + starB.az;
        pointCount += 2;
      }
    }

    if (visibleLines.length > 0 && pointCount > 0) {
      result.push({
        id: constellation.id,
        name: constellation.name,
        lines: visibleLines,
        centroid: { alt: altSum / pointCount, az: azSum / pointCount },
      });
    }
  }

  return result;
}
