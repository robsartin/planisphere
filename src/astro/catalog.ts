/* SPDX-License-Identifier: Apache-2.0 */
import { err, ok, type Result } from "../result";

export type StarRecord = {
  readonly hip: number;
  readonly ra: number;
  readonly dec: number;
  readonly mag: number;
  readonly name?: string;
};

export type CatalogLoadError = { kind: "catalog-load-failed"; message: string };

export function parseCatalog(raw: unknown): Result<StarRecord[], CatalogLoadError> {
  if (!Array.isArray(raw)) {
    return err({ kind: "catalog-load-failed", message: "Star catalog is not an array" });
  }
  if (raw.length === 0) {
    return err({ kind: "catalog-load-failed", message: "Star catalog is empty" });
  }

  const stars: StarRecord[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const e = entry as Record<string, unknown>;
    const hip = Number(e.hip);
    const ra = Number(e.ra);
    const dec = Number(e.dec);
    const mag = Number(e.mag);
    if (!Number.isFinite(hip) || hip <= 0) continue;
    if (!Number.isFinite(ra) || !Number.isFinite(dec) || !Number.isFinite(mag)) continue;
    const name = typeof e.name === "string" && e.name.length > 0 ? e.name : undefined;
    stars.push({ hip, ra, dec, mag, ...(name !== undefined ? { name } : {}) });
  }

  if (stars.length === 0) {
    return err({ kind: "catalog-load-failed", message: "No valid stars after parsing" });
  }
  return ok(stars);
}
