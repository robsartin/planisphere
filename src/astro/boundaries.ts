/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";
import { fastRaDecToAltAz } from "./fast-coords";

export type BoundaryVertex = {
  readonly ra: number; // degrees
  readonly dec: number; // degrees
};

export type BoundaryRecord = {
  readonly id: string; // IAU abbreviation e.g. "Ori"
  readonly vertices: readonly BoundaryVertex[];
};

export type BoundaryLoadError = { kind: "boundary-load-failed"; message: string };

export type VisibleBoundary = {
  readonly id: string;
  readonly name: string;
  readonly segments: readonly {
    readonly start: { readonly ra: number; readonly dec: number };
    readonly end: { readonly ra: number; readonly dec: number };
  }[];
};

/**
 * Parse raw JSON array into typed BoundaryRecord[].
 * Skips entries missing `id` or with fewer than 3 vertices.
 */
export function parseBoundaries(raw: unknown): Result<BoundaryRecord[], BoundaryLoadError> {
  if (!Array.isArray(raw)) {
    return err({ kind: "boundary-load-failed", message: "Boundary data is not an array" });
  }
  if (raw.length === 0) {
    return err({ kind: "boundary-load-failed", message: "Boundary data is empty" });
  }

  const result: BoundaryRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.id !== "string" || !e.id) continue;
    if (!Array.isArray(e.vertices) || e.vertices.length < 3) continue;

    const vertices: BoundaryVertex[] = [];
    for (const v of e.vertices) {
      if (typeof v !== "object" || v === null) continue;
      const vr = v as Record<string, unknown>;
      const ra = Number(vr.ra);
      const dec = Number(vr.dec);
      if (Number.isFinite(ra) && Number.isFinite(dec)) {
        vertices.push({ ra, dec });
      }
    }
    if (vertices.length >= 3) {
      result.push({ id: e.id, vertices });
    }
  }

  if (result.length === 0) {
    return err({ kind: "boundary-load-failed", message: "No valid boundaries after parsing" });
  }
  return ok(result);
}

/**
 * Filter boundaries to those with at least one vertex above the horizon.
 * Returns consecutive vertex pairs as line segments (polygon edges).
 *
 * @param altFn - injectable altitude calculator for testing; defaults to raDecToAltAz
 */
export type FilterVisibleBoundariesOptions = {
  /** Optional lookup from IAU 3-letter code to display name (e.g. `"Ori" → "Orion"`).
   *  When absent (or a boundary's id has no entry), `name` falls back to `id` —
   *  the popup keeps working, it just shows the raw code. */
  readonly namesByCode?: ReadonlyMap<string, string>;
  /** Injectable altitude function (kept for existing tests that mock it). */
  readonly altFn?: (ra: number, dec: number, lat: number, lon: number, time: Date) => number;
};

export function filterVisibleBoundaries(
  boundaries: BoundaryRecord[],
  lat: number,
  lon: number,
  timeUtc: Date,
  optionsOrAltFn?:
    | FilterVisibleBoundariesOptions
    | ((ra: number, dec: number, lat: number, lon: number, time: Date) => number),
): VisibleBoundary[] {
  const options: FilterVisibleBoundariesOptions =
    typeof optionsOrAltFn === "function" ? { altFn: optionsOrAltFn } : (optionsOrAltFn ?? {});
  const altFn =
    options.altFn ??
    ((ra, dec, observerLat, observerLon, time) =>
      fastRaDecToAltAz(ra, dec, observerLat, observerLon, time).alt);
  const namesByCode = options.namesByCode;

  const result: VisibleBoundary[] = [];

  for (const boundary of boundaries) {
    const alts = boundary.vertices.map((v) => altFn(v.ra, v.dec, lat, lon, timeUtc));
    const hasVisible = alts.some((a) => a > 0);
    if (!hasVisible) continue;

    const segments: VisibleBoundary["segments"][number][] = [];
    for (let i = 0; i < boundary.vertices.length; i++) {
      const start = boundary.vertices[i]!;
      const end = boundary.vertices[(i + 1) % boundary.vertices.length]!;
      segments.push({ start, end });
    }
    result.push({
      id: boundary.id,
      name: namesByCode?.get(boundary.id) ?? boundary.id,
      segments,
    });
  }

  return result;
}
